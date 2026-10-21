package com.jtdev.website.observability;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.common.AttributesBuilder;
import io.opentelemetry.api.common.KeyValue;
import io.opentelemetry.api.common.Value;
import io.opentelemetry.api.common.ValueType;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.sdk.common.InstrumentationScopeInfo;
import io.opentelemetry.sdk.common.InstrumentationLibraryInfo;
import io.opentelemetry.sdk.common.InstrumentationScopeInfoBuilder;
import io.opentelemetry.sdk.logs.data.Body;
import io.opentelemetry.sdk.logs.data.LogRecordData;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.data.DelegatingSpanData;
import io.opentelemetry.sdk.trace.data.EventData;
import io.opentelemetry.sdk.trace.data.LinkData;
import io.opentelemetry.sdk.trace.data.SpanData;
import io.opentelemetry.sdk.trace.data.StatusData;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Redacts accidental secrets and direct identifiers from telemetry immediately before export.
 * Safe operation names and typed low-cardinality attributes are retained so the resulting data
 * remains useful for debugging and aggregation.
 */
public final class TelemetryPrivacy {

    private static final String REDACTED = "[REDACTED]";
    private static final String TRUNCATED = "…[truncated]";
    private static final int MAX_BODY_CHARS = 8_192;
    private static final int MAX_EXCEPTION_ATTRIBUTE_CHARS = 16_384;
    private static final int MAX_ATTRIBUTE_CHARS = 2_048;

    private static final Pattern SECRET_KEY_VALUE = Pattern.compile(
            "(?i)\\b(authorization|proxy[_-]?authorization|cookie|set[_-]?cookie|password|passwd|secret|token|"
                    + "api[_-]?key|client[_-]?secret|credential|credentials|email|e[_-]?mail|username|user[_-]?(?:id|name)|"
                    + "account[_-]?(?:id|number|name|email|password|token|secret|key)|user[_-]?account)\\b"
                    + "(\\s*[:=]\\s*)(?:\"[^\"]*\"|'[^']*'|[^\\s,;]+)");
    private static final Pattern BEARER_TOKEN = Pattern.compile(
            "(?i)\\b(Bearer\\s+)[A-Za-z0-9._~+/-]+=*");
    private static final Pattern URI_CREDENTIALS = Pattern.compile(
            "(?i)(https?://)[^/@\\s?#]*@");
    private static final Pattern QUERY_VALUE = Pattern.compile(
            "([?&][^\\s=?&#]+)=([^&#\\s]*)");
    private static final Pattern EMAIL = Pattern.compile(
            "(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b");
    private static final Pattern IPV4 = Pattern.compile(
            "(?<![\\w.])(?:(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])\\.){3}"
                    + "(?:25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])(?![\\w.])");
    private static final Pattern IPV6 = Pattern.compile(
            "(?i)(?<![0-9a-z])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?:%[a-z0-9_.-]+)?(?![0-9a-z])");

    private static final Pattern ATTRIBUTE_CREDENTIAL = Pattern.compile(
            "(?:^|[._-])(?:authorization|proxy[_-]?authorization|cookie|set[_-]?cookie|password|passwd|secret|token|"
                    + "api[_-]?key|apikey|client[_-]?secret|credential|credentials|email|e[_-]?mail|username)(?:$|[._-])");
    private static final Pattern USER_ACCOUNT_ATTRIBUTE = Pattern.compile(
            "^(?:user|account)(?:[._-](?:id|name|email|number|username|password|token|secret|credential|credentials))?$"
                    + "|(?:^|[._-])(?:user[_-]?(?:id|name|email|username)|account[_-]?(?:id|number|name|email|username|password|token|secret|key|credential|credentials))(?:$|[._-])");

    private final String ingestKey;

    /**
     * @param ingestKey an optional private ingest credential to redact if it appears in telemetry
     */
    public TelemetryPrivacy(String ingestKey) {
        this.ingestKey = ingestKey == null || ingestKey.isEmpty() ? null : ingestKey;
    }

    /** Returns a privacy-sanitized view while retaining the original span's identity and meaning. */
    public SpanData sanitize(SpanData spanData) {
        Objects.requireNonNull(spanData, "spanData");
        return new SanitizedSpanData(spanData);
    }

    /** Returns a privacy-sanitized view of a log record without dropping correlation or metadata. */
    public LogRecordData sanitize(LogRecordData logRecordData) {
        Objects.requireNonNull(logRecordData, "logRecordData");
        return new SanitizedLogRecordData(logRecordData);
    }

    /**
     * Excludes only successful, routine server health/readiness spans. Error spans remain useful
     * diagnostic records even when the failing request targets a health endpoint.
     */
    public boolean shouldExport(SpanData spanData) {
        Objects.requireNonNull(spanData, "spanData");
        if (spanData.getKind() != SpanKind.SERVER || isError(spanData)) {
            return true;
        }

        String path = firstNonBlank(
                stringAttribute(spanData.getAttributes(), "http.route"),
                stringAttribute(spanData.getAttributes(), "url.path"),
                stringAttribute(spanData.getAttributes(), "http.target"),
                stringAttribute(spanData.getAttributes(), "http.url"),
                pathFromName(spanData.getName()));
        return !isHealthPath(path);
    }

    private boolean isError(SpanData spanData) {
        if (spanData.getStatus().getStatusCode() == StatusCode.ERROR) {
            return true;
        }
        Long responseCode = numericAttribute(spanData.getAttributes(), "http.response.status_code");
        if (responseCode == null) {
            responseCode = numericAttribute(spanData.getAttributes(), "http.status_code");
        }
        if (responseCode != null && responseCode >= 400) {
            return true;
        }
        if (spanData.getAttributes().get(AttributeKey.stringKey("exception.type")) != null
                || spanData.getAttributes().get(AttributeKey.stringKey("error.type")) != null) {
            return true;
        }
        return spanData.getEvents().stream().anyMatch(event ->
                "exception".equalsIgnoreCase(event.getName())
                        || event.getAttributes().get(AttributeKey.stringKey("exception.type")) != null);
    }

    private static boolean isHealthPath(String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return false;
        }
        String path = pathFromName(candidate).trim();
        int query = path.indexOf('?');
        if (query >= 0) {
            path = path.substring(0, query);
        }
        int fragment = path.indexOf('#');
        if (fragment >= 0) {
            path = path.substring(0, fragment);
        }
        while (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }

        String lower = path.toLowerCase(Locale.ROOT);
        return isPathOrChild(lower, "/actuator/health")
                || isPathOrChild(lower, "/health")
                || isPathOrChild(lower, "/healthz")
                || isPathOrChild(lower, "/ready")
                || isPathOrChild(lower, "/readyz")
                || isPathOrChild(lower, "/readiness")
                || isPathOrChild(lower, "/live")
                || isPathOrChild(lower, "/livez")
                || isPathOrChild(lower, "/liveness")
                || isPathOrChild(lower, "/-/healthy")
                || isPathOrChild(lower, "/-/ready");
    }

    private static boolean isPathOrChild(String path, String root) {
        return path.equals(root) || path.startsWith(root + "/");
    }

    private static String pathFromName(String name) {
        if (name == null) {
            return null;
        }
        String value = name.trim();
        int space = value.indexOf(' ');
        if (space > 0 && value.substring(0, space).matches("(?i)(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)")) {
            value = value.substring(space + 1).trim();
        }
        if (value.regionMatches(true, 0, "http://", 0, 7)
                || value.regionMatches(true, 0, "https://", 0, 8)) {
            int authorityStart = value.indexOf("//") + 2;
            int pathStart = value.indexOf('/', authorityStart);
            value = pathStart < 0 ? "/" : value.substring(pathStart);
        }
        return value;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static String stringAttribute(Attributes attributes, String name) {
        Object[] found = new Object[1];
        attributes.forEach((key, value) -> {
            if (name.equals(key.getKey())) {
                found[0] = value;
            }
        });
        return found[0] instanceof String string ? string : null;
    }

    private static Long numericAttribute(Attributes attributes, String name) {
        Object[] found = new Object[1];
        attributes.forEach((key, value) -> {
            if (name.equals(key.getKey())) {
                found[0] = value;
            }
        });
        if (found[0] instanceof Number number) {
            return number.longValue();
        }
        if (found[0] instanceof String string) {
            try {
                return Long.parseLong(string);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private Attributes sanitizeAttributes(Attributes attributes) {
        AttributesBuilder sanitized = Attributes.builder();
        attributes.forEach((key, value) -> {
            String keyName = key.getKey();
            if (isSensitiveAttribute(keyName) || value == null) {
                return;
            }
            Object safeValue = sanitizeAttributeValue(keyName, value);
            if (safeValue != null) {
                put(sanitized, key, safeValue);
            }
        });
        return sanitized.build();
    }

    private Object sanitizeAttributeValue(String key, Object value) {
        int maxChars = isExceptionAttribute(key) ? MAX_EXCEPTION_ATTRIBUTE_CHARS : MAX_ATTRIBUTE_CHARS;
        if (value instanceof String string) {
            return truncate(sanitizeText(string), maxChars);
        }
        if (value instanceof List<?> list) {
            List<Object> safe = new ArrayList<>(list.size());
            for (Object item : list) {
                safe.add(item instanceof String string ? truncate(sanitizeText(string), maxChars) : item);
            }
            return List.copyOf(safe);
        }
        return value;
    }

    private static boolean isExceptionAttribute(String key) {
        String normalized = normalizeKey(key);
        return normalized.startsWith("exception.")
                || normalized.equals("error.message")
                || normalized.equals("error.stacktrace");
    }

    private static boolean isSensitiveAttribute(String key) {
        String normalized = normalizeKey(key);
        if (ATTRIBUTE_CREDENTIAL.matcher(normalized).find() || USER_ACCOUNT_ATTRIBUTE.matcher(normalized).matches()) {
            return true;
        }
        return normalized.equals("url")
                || normalized.equals("http.url")
                || normalized.equals("url.full")
                || normalized.equals("url.original")
                || normalized.equals("url.query")
                || normalized.equals("url.path")
                || normalized.equals("http.path")
                || normalized.equals("http.request.path")
                || normalized.equals("http.target")
                || normalized.equals("http.request.uri")
                || normalized.equals("http.request.url")
                || normalized.equals("http.raw_path")
                || normalized.equals("client.address")
                || normalized.equals("client.ip")
                || normalized.equals("http.client_ip")
                || normalized.equals("http.request.header.user-agent")
                || normalized.equals("http.user_agent")
                || normalized.equals("user_agent")
                || normalized.equals("user_agent.original")
                || normalized.equals("net.peer.ip")
                || normalized.equals("network.peer.address")
                || normalized.equals("network.peer.ip")
                || normalized.equals("peer.address")
                || normalized.equals("peer.ip")
                || normalized.equals("remote.ip")
                || normalized.equals("remote_addr")
                || normalized.equals("db.statement")
                || normalized.startsWith("db.statement.")
                || normalized.equals("db.query")
                || normalized.startsWith("db.query.");
    }

    private static String normalizeKey(String key) {
        return key.toLowerCase(Locale.ROOT);
    }

    private String sanitizeText(String original) {
        if (original == null || original.isEmpty()) {
            return original;
        }
        String safe = original;
        if (ingestKey != null) {
            safe = safe.replace(ingestKey, REDACTED);
        }
        safe = replaceAll(URI_CREDENTIALS, safe, "$1" + REDACTED + "@");
        safe = replaceAll(BEARER_TOKEN, safe, "$1" + REDACTED);
        safe = replaceAll(SECRET_KEY_VALUE, safe, "$1$2" + REDACTED);
        safe = replaceAll(QUERY_VALUE, safe, "$1=" + REDACTED);
        safe = replaceAll(EMAIL, safe, REDACTED);
        safe = replaceAll(IPV4, safe, REDACTED);
        safe = replaceAll(IPV6, safe, REDACTED);
        return safe;
    }

    private static String replaceAll(Pattern pattern, String input, String replacement) {
        Matcher matcher = pattern.matcher(input);
        return matcher.replaceAll(replacement);
    }

    private static String truncate(String value, int maxChars) {
        if (value == null || value.length() <= maxChars) {
            return value;
        }
        int visibleLength = Math.max(0, maxChars - TRUNCATED.length());
        return value.substring(0, visibleLength) + TRUNCATED;
    }

    private Resource sanitizeResource(Resource resource) {
        return Resource.create(sanitizeAttributes(resource.getAttributes()), resource.getSchemaUrl());
    }

    private InstrumentationScopeInfo sanitizeScope(InstrumentationScopeInfo scope) {
        InstrumentationScopeInfoBuilder builder = InstrumentationScopeInfo.builder(
                truncate(sanitizeText(scope.getName()), MAX_ATTRIBUTE_CHARS));
        if (scope.getVersion() != null) {
            builder.setVersion(truncate(sanitizeText(scope.getVersion()), MAX_ATTRIBUTE_CHARS));
        }
        if (scope.getSchemaUrl() != null) {
            builder.setSchemaUrl(truncate(sanitizeText(scope.getSchemaUrl()), MAX_ATTRIBUTE_CHARS));
        }
        builder.setAttributes(sanitizeAttributes(scope.getAttributes()));
        return builder.build();
    }

    private InstrumentationLibraryInfo sanitizeLibraryInfo(InstrumentationLibraryInfo info) {
        return InstrumentationLibraryInfo.create(
                truncate(sanitizeText(info.getName()), MAX_ATTRIBUTE_CHARS),
                info.getVersion() == null ? null : truncate(sanitizeText(info.getVersion()), MAX_ATTRIBUTE_CHARS),
                info.getSchemaUrl() == null ? null : truncate(sanitizeText(info.getSchemaUrl()), MAX_ATTRIBUTE_CHARS));
    }

    private static Value<?> sanitizeValue(Value<?> value, TelemetryPrivacy privacy, int maxStringChars) {
        if (value == null) {
            return Value.empty();
        }
        ValueType type = value.getType();
        return switch (type) {
            case STRING -> Value.of(truncate(privacy.sanitizeText(value.asString()), maxStringChars));
            case BOOLEAN -> Value.of((Boolean) value.getValue());
            case LONG -> Value.of((Long) value.getValue());
            case DOUBLE -> Value.of((Double) value.getValue());
            case ARRAY -> {
                @SuppressWarnings("unchecked")
                List<Value<?>> values = (List<Value<?>>) value.getValue();
                List<Value<?>> safe = new ArrayList<>(values.size());
                for (Value<?> item : values) {
                    safe.add(sanitizeValue(item, privacy, maxStringChars));
                }
                yield Value.of(safe);
            }
            case KEY_VALUE_LIST -> {
                @SuppressWarnings("unchecked")
                List<KeyValue> values = (List<KeyValue>) value.getValue();
                Map<String, Value<?>> safe = new LinkedHashMap<>();
                for (KeyValue item : values) {
                    if (!isSensitiveAttribute(item.getKey())) {
                        int itemLimit = isExceptionAttribute(item.getKey())
                                ? MAX_EXCEPTION_ATTRIBUTE_CHARS
                                : Math.min(maxStringChars, MAX_ATTRIBUTE_CHARS);
                        safe.put(item.getKey(), sanitizeValue(item.getValue(), privacy, itemLimit));
                    }
                }
                yield Value.of(safe);
            }
            case BYTES -> Value.of(copyBytes((ByteBuffer) value.getValue()));
            case EMPTY -> Value.empty();
        };
    }

    private static byte[] copyBytes(ByteBuffer original) {
        ByteBuffer copy = original.asReadOnlyBuffer();
        byte[] bytes = new byte[copy.remaining()];
        copy.get(bytes);
        return bytes;
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static void put(AttributesBuilder builder, AttributeKey key, Object value) {
        builder.put(key, value);
    }

    private final class SanitizedSpanData extends DelegatingSpanData {
        private final Resource resource;
        private final Attributes attributes;
        private final List<EventData> events;
        private final List<LinkData> links;
        private final StatusData status;
        private final InstrumentationScopeInfo scope;
        private final InstrumentationLibraryInfo libraryInfo;

        private SanitizedSpanData(SpanData delegate) {
            super(delegate);
            this.resource = sanitizeResource(delegate.getResource());
            this.attributes = sanitizeAttributes(delegate.getAttributes());
            this.events = delegate.getEvents().stream()
                    .map(event -> EventData.create(
                            event.getEpochNanos(),
                            truncate(sanitizeText(event.getName()), MAX_ATTRIBUTE_CHARS),
                            sanitizeAttributes(event.getAttributes()),
                            event.getTotalAttributeCount()))
                    .toList();
            this.links = delegate.getLinks().stream()
                    .map(link -> LinkData.create(
                            link.getSpanContext(),
                            sanitizeAttributes(link.getAttributes()),
                            link.getTotalAttributeCount()))
                    .toList();
            StatusData originalStatus = delegate.getStatus();
            String description = sanitizeText(originalStatus.getDescription());
            this.status = StatusData.create(
                    originalStatus.getStatusCode(),
                    truncate(description == null ? "" : description, MAX_EXCEPTION_ATTRIBUTE_CHARS));
            this.scope = sanitizeScope(delegate.getInstrumentationScopeInfo());
            this.libraryInfo = sanitizeLibraryInfo(delegate.getInstrumentationLibraryInfo());
        }

        @Override
        public Resource getResource() {
            return resource;
        }

        @Override
        public Attributes getAttributes() {
            return attributes;
        }

        @Override
        public List<EventData> getEvents() {
            return events;
        }

        @Override
        public List<LinkData> getLinks() {
            return links;
        }

        @Override
        public StatusData getStatus() {
            return status;
        }

        @Override
        public InstrumentationScopeInfo getInstrumentationScopeInfo() {
            return scope;
        }

        @Override
        public InstrumentationLibraryInfo getInstrumentationLibraryInfo() {
            return libraryInfo;
        }

        @Override
        public String getName() {
            return truncate(sanitizeText(super.getName()), MAX_ATTRIBUTE_CHARS);
        }
    }

    private final class SanitizedLogRecordData implements LogRecordData {
        private final LogRecordData delegate;
        private final Resource resource;
        private final Attributes attributes;
        private final Value<?> bodyValue;
        private final String eventName;
        private final InstrumentationScopeInfo scope;

        @SuppressWarnings("deprecation")
        private SanitizedLogRecordData(LogRecordData delegate) {
            this.delegate = delegate;
            this.resource = sanitizeResource(delegate.getResource());
            this.attributes = sanitizeAttributes(delegate.getAttributes());
            this.bodyValue = sanitizeValue(delegate.getBodyValue(), TelemetryPrivacy.this, MAX_BODY_CHARS);
            this.eventName = truncate(sanitizeText(delegate.getEventName()), MAX_ATTRIBUTE_CHARS);
            this.scope = sanitizeScope(delegate.getInstrumentationScopeInfo());
        }

        @Override
        public Resource getResource() {
            return resource;
        }

        @Override
        public InstrumentationScopeInfo getInstrumentationScopeInfo() {
            return scope;
        }

        @Override
        public long getTimestampEpochNanos() {
            return delegate.getTimestampEpochNanos();
        }

        @Override
        public long getObservedTimestampEpochNanos() {
            return delegate.getObservedTimestampEpochNanos();
        }

        @Override
        public io.opentelemetry.api.trace.SpanContext getSpanContext() {
            return delegate.getSpanContext();
        }

        @Override
        public io.opentelemetry.api.logs.Severity getSeverity() {
            return delegate.getSeverity();
        }

        @Override
        public String getSeverityText() {
            return delegate.getSeverityText();
        }

        /** Retains compatibility with the deprecated API while reflecting the sanitized body. */
        @Override
        @Deprecated
        public Body getBody() {
            if (bodyValue.getType() == ValueType.EMPTY) {
                return Body.empty();
            }
            return Body.string(bodyValue.asString());
        }

        @Override
        public Value<?> getBodyValue() {
            return bodyValue;
        }

        @Override
        public Attributes getAttributes() {
            return attributes;
        }

        @Override
        public int getTotalAttributeCount() {
            return delegate.getTotalAttributeCount();
        }

        @Override
        public String getEventName() {
            return eventName;
        }
    }
}
