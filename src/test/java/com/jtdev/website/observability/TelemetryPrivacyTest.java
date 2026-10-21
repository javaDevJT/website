package com.jtdev.website.observability;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.logs.Severity;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanContext;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.TraceFlags;
import io.opentelemetry.api.trace.TraceState;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Context;
import io.opentelemetry.sdk.common.InstrumentationScopeInfo;
import io.opentelemetry.sdk.logs.data.Body;
import io.opentelemetry.sdk.logs.data.LogRecordData;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.data.EventData;
import io.opentelemetry.sdk.trace.data.SpanData;
import io.opentelemetry.sdk.testing.exporter.InMemorySpanExporter;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.SimpleSpanProcessor;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TelemetryPrivacyTest {

    private static final String INGEST_KEY = "collector-secret-9dbf7c";

    @Test
    void logSanitizationPreservesStartupAndExceptionSemanticsAndMetadata() {
        TelemetryPrivacy privacy = new TelemetryPrivacy(INGEST_KEY);
        Resource resource = Resource.create(Attributes.builder()
                .put("service.name", "website")
                .put("service.version", "1.2.3")
                .put("user.email", "private@example.com")
                .build());
        InstrumentationScopeInfo scope = InstrumentationScopeInfo.create("com.jtdev.website.startup");

        TestLogRecord startup = new TestLogRecord(
                "Website application started on port 8080",
                Severity.INFO,
                "INFO",
                1_725_000_000_000_000_000L,
                1_725_000_000_000_000_001L,
                SpanContext.getInvalid(),
                Attributes.of(AttributeKey.booleanKey("startup.complete"), true),
                resource,
                scope,
                "application.startup");

        LogRecordData safeStartup = privacy.sanitize(startup);
        assertEquals(startup.body, safeStartup.getBodyValue().asString());
        assertEquals(startup.body, safeStartup.getBody().asString());
        assertEquals(Severity.INFO, safeStartup.getSeverity());
        assertEquals("INFO", safeStartup.getSeverityText());
        assertEquals(startup.timestamp, safeStartup.getTimestampEpochNanos());
        assertEquals(startup.observedTimestamp, safeStartup.getObservedTimestampEpochNanos());
        assertFalse(safeStartup.getSpanContext().isValid(), "uncorrelated startup logs must survive");
        assertEquals("application.startup", safeStartup.getEventName());
        assertEquals("com.jtdev.website.startup", safeStartup.getInstrumentationScopeInfo().getName());
        assertEquals("website", safeStartup.getResource().getAttribute(AttributeKey.stringKey("service.name")));
        assertNull(safeStartup.getResource().getAttribute(AttributeKey.stringKey("user.email")));
        assertEquals(Boolean.TRUE, safeStartup.getAttributes().get(AttributeKey.booleanKey("startup.complete")));

        SpanContext correlation = SpanContext.create(
                "0000000000000000000000000000abcd",
                "000000000000abcd",
                TraceFlags.getSampled(),
                TraceState.getDefault());
        String exceptionMessage = "Cannot read article for person@example.com; token=" + INGEST_KEY
                + " at 203.0.113.16";
        String stack = "java.lang.IllegalStateException: " + exceptionMessage
                + "\n\tat com.jtdev.website.ContentService.load(ContentService.java:42)";
        TestLogRecord exception = new TestLogRecord(
                "Unable to load article: " + exceptionMessage,
                Severity.ERROR,
                "ERROR",
                1_725_000_000_000_000_010L,
                1_725_000_000_000_000_011L,
                correlation,
                Attributes.builder()
                        .put("exception.type", "java.lang.IllegalStateException")
                        .put("exception.message", exceptionMessage)
                        .put("exception.stacktrace", stack)
                        .put("content.collection", "articles")
                        .build(),
                resource,
                scope,
                "website.operation.failed");

        LogRecordData safeException = privacy.sanitize(exception);
        assertEquals(Severity.ERROR, safeException.getSeverity());
        assertSame(correlation, safeException.getSpanContext());
        assertEquals("website.operation.failed", safeException.getEventName());
        assertTrue(safeException.getBodyValue().asString().contains("Unable to load article:"));
        assertEquals(safeException.getBodyValue().asString(), safeException.getBody().asString());
        assertTrue(safeException.getAttributes().get(AttributeKey.stringKey("exception.type"))
                .contains("IllegalStateException"));
        assertTrue(safeException.getAttributes().get(AttributeKey.stringKey("exception.message"))
                .contains("Cannot read article"));
        assertTrue(safeException.getAttributes().get(AttributeKey.stringKey("exception.stacktrace"))
                .contains("ContentService.load"));
        assertEquals("articles", safeException.getAttributes().get(AttributeKey.stringKey("content.collection")));
        assertRedacted(safeException.getBodyValue().asString(), INGEST_KEY, "person@example.com", "203.0.113.16");
        assertRedacted(safeException.getAttributes().get(AttributeKey.stringKey("exception.message")),
                INGEST_KEY, "person@example.com", "203.0.113.16");
        assertRedacted(safeException.getAttributes().get(AttributeKey.stringKey("exception.stacktrace")),
                INGEST_KEY, "person@example.com", "203.0.113.16");
        assertEquals(exception.getTotalAttributeCount(), safeException.getTotalAttributeCount());
    }

    @Test
    void logSanitizationRemovesSecretAttributesAndTargetedTextWhileKeepingTypedTags() {
        String body = "Request failed for jane.doe@example.net from 198.51.100.27; "
                + "Bearer eyJhbGciOiJub25lIn0.signature; password=hunter2; token=" + INGEST_KEY
                + "; URL https://account:pw@api.example.test/items?item=private&view=full";
        Attributes attributes = Attributes.builder()
                .put("http.url", "https://user:password@example.test/path?key=value")
                .put("url.path", "/private/person@example.net/secret-token")
                .put("http.path", "/private/person@example.net/secret-token")
                .put("http.request.path", "/private/person@example.net/secret-token")
                .put("client.address", "192.0.2.10")
                .put("http.request.header.user-agent", "Mozilla/5.0")
                .put("http.request.header.authorization", "Bearer secret-token")
                .put("user.email", "jane.doe@example.net")
                .put("account.id", "acct-secret-44")
                .put("db.statement", "select email from user where email='jane@example.net'")
                .put("http.route", "/api/articles/{slug}")
                .put("http.request.method", "GET")
                .put("http.response.status_code", 200L)
                .put("content.collection", "articles")
                .put("operation", "content.resource.read")
                .put("feature.enabled", true)
                .build();
        TestLogRecord log = new TestLogRecord(
                body,
                Severity.WARN,
                "WARN",
                77L,
                88L,
                SpanContext.getInvalid(),
                attributes,
                Resource.empty(),
                InstrumentationScopeInfo.create("com.jtdev.website.request"),
                "request.warning");

        LogRecordData safe = new TelemetryPrivacy(INGEST_KEY).sanitize(log);
        assertRedacted(safe.getBodyValue().asString(), "jane.doe@example.net", "198.51.100.27", "hunter2",
                INGEST_KEY, "eyJhbGciOiJub25lIn0.signature", "account:pw", "private", "full");
        assertTrue(safe.getBodyValue().asString().contains("Request failed for"));
        assertTrue(safe.getBodyValue().asString().contains("/items?item="));
        assertEquals(safe.getBodyValue().asString(), safe.getBody().asString());

        Attributes safeAttributes = safe.getAttributes();
        assertNull(safeAttributes.get(AttributeKey.stringKey("http.url")));
        assertNull(safeAttributes.get(AttributeKey.stringKey("url.path")));
        assertNull(safeAttributes.get(AttributeKey.stringKey("http.path")));
        assertNull(safeAttributes.get(AttributeKey.stringKey("http.request.path")));
        assertNull(safeAttributes.get(AttributeKey.stringKey("client.address")));
        assertNull(safeAttributes.get(AttributeKey.stringKey("http.request.header.user-agent")));
        assertNull(safeAttributes.get(AttributeKey.stringKey("http.request.header.authorization")));
        assertNull(safeAttributes.get(AttributeKey.stringKey("user.email")));
        assertNull(safeAttributes.get(AttributeKey.stringKey("account.id")));
        assertNull(safeAttributes.get(AttributeKey.stringKey("db.statement")));
        assertEquals("/api/articles/{slug}", safeAttributes.get(AttributeKey.stringKey("http.route")));
        assertEquals("GET", safeAttributes.get(AttributeKey.stringKey("http.request.method")));
        assertEquals(200L, safeAttributes.get(AttributeKey.longKey("http.response.status_code")));
        assertEquals("articles", safeAttributes.get(AttributeKey.stringKey("content.collection")));
        assertEquals("content.resource.read", safeAttributes.get(AttributeKey.stringKey("operation")));
        assertEquals(Boolean.TRUE, safeAttributes.get(AttributeKey.booleanKey("feature.enabled")));
        assertFalse(safe.getSpanContext().isValid(), "invalid context must not cause a log record to be dropped");
    }

    @Test
    void spanWrapperPreservesOperationContextErrorsAndSafeTypedAttributes() {
        SpanData original = createSpan("content.resource.read", SpanKind.INTERNAL, true, true);
        SpanData safe = new TelemetryPrivacy(INGEST_KEY).sanitize(original);

        assertEquals("content.resource.read", safe.getName());
        assertEquals(SpanKind.INTERNAL, safe.getKind());
        assertTrue(safe.getSpanContext().isValid());
        assertTrue(safe.getParentSpanContext().isValid());
        assertEquals(original.getParentSpanContext(), safe.getParentSpanContext());
        assertEquals(StatusCode.ERROR, safe.getStatus().getStatusCode());
        assertTrue(safe.getStatus().getDescription().contains("Could not load article"));
        assertFalse(safe.getStatus().getDescription().contains(INGEST_KEY));

        Attributes attributes = safe.getAttributes();
        assertEquals("articles", attributes.get(AttributeKey.stringKey("content.collection")));
        assertEquals("content.resource.read", attributes.get(AttributeKey.stringKey("operation")));
        assertEquals("GET", attributes.get(AttributeKey.stringKey("http.request.method")));
        assertEquals(503L, attributes.get(AttributeKey.longKey("http.response.status_code")));
        assertEquals(Boolean.TRUE, attributes.get(AttributeKey.booleanKey("cache.hit")));
        assertNull(attributes.get(AttributeKey.stringKey("http.url")));
        assertNull(attributes.get(AttributeKey.stringKey("db.statement")));
        assertNull(attributes.get(AttributeKey.stringKey("client.address")));

        EventData exception = safe.getEvents().stream()
                .filter(event -> "exception".equals(event.getName()))
                .findFirst()
                .orElseThrow();
        String exceptionMessage = exception.getAttributes().get(AttributeKey.stringKey("exception.message"));
        String stackTrace = exception.getAttributes().get(AttributeKey.stringKey("exception.stacktrace"));
        assertTrue(exception.getAttributes().get(AttributeKey.stringKey("exception.type"))
                .contains("IllegalStateException"));
        assertTrue(exceptionMessage.contains("database timeout"));
        assertTrue(stackTrace.contains("ContentService.load"));
        assertRedacted(exceptionMessage, INGEST_KEY, "person@example.com", "203.0.113.88");
        assertRedacted(stackTrace, INGEST_KEY, "person@example.com", "203.0.113.88");
        assertTrue(safe.getLinks().getFirst().getSpanContext().isValid());
        assertNull(safe.getLinks().getFirst().getAttributes().get(AttributeKey.stringKey("email")));
        assertEquals("article", safe.getLinks().getFirst().getAttributes()
                .get(AttributeKey.stringKey("content.collection")));
        assertTrue(safe.getResource().getAttribute(AttributeKey.stringKey("service.name")).equals("website"));
    }

    @Test
    void onlyRoutineServerHealthSpansAreExcluded() {
        TelemetryPrivacy privacy = new TelemetryPrivacy(null);
        assertFalse(privacy.shouldExport(createSpan("GET /actuator/health/liveness", SpanKind.SERVER, false, false)));
        assertFalse(privacy.shouldExport(createSpan("GET /readyz", SpanKind.SERVER, false, false)));
        assertTrue(privacy.shouldExport(createSpan("GET /content/articles", SpanKind.SERVER, false, false)));
        assertTrue(privacy.shouldExport(createSpan("GET /actuator/health", SpanKind.SERVER, true, false)),
                "health endpoint failures remain diagnostic spans");
        assertTrue(privacy.shouldExport(createSpan("GET /actuator/health", SpanKind.INTERNAL, false, false)),
                "internal work with a similar name is not a routine server health span");
    }

    @Test
    void bodyAndAttributesAreBoundedWithVisibleTruncation() {
        String oversized = "x".repeat(20_000);
        Attributes attributes = Attributes.builder()
                .put("content.note", oversized)
                .put("exception.message", oversized)
                .build();
        TestLogRecord log = new TestLogRecord(
                oversized, Severity.INFO, "INFO", 1L, 2L, SpanContext.getInvalid(), attributes,
                Resource.empty(), InstrumentationScopeInfo.empty(), null);

        LogRecordData safe = new TelemetryPrivacy(null).sanitize(log);
        assertTrue(safe.getBodyValue().asString().length() <= 8_192);
        assertTrue(safe.getBodyValue().asString().endsWith("…[truncated]"));
        assertTrue(safe.getAttributes().get(AttributeKey.stringKey("content.note")).length() <= 2_048);
        assertTrue(safe.getAttributes().get(AttributeKey.stringKey("content.note")).endsWith("…[truncated]"));
        assertTrue(safe.getAttributes().get(AttributeKey.stringKey("exception.message")).length() <= 16_384);
        assertTrue(safe.getAttributes().get(AttributeKey.stringKey("exception.message")).endsWith("…[truncated]"));
    }

    private static SpanData createSpan(String name, SpanKind kind, boolean error, boolean richAttributes) {
        InMemorySpanExporter exporter = InMemorySpanExporter.create();
        SdkTracerProvider provider = SdkTracerProvider.builder()
                .setResource(Resource.create(Attributes.of(AttributeKey.stringKey("service.name"), "website")))
                .addSpanProcessor(SimpleSpanProcessor.create(exporter))
                .build();
        Tracer tracer = provider.get("com.jtdev.website.test");

        Span parent = tracer.spanBuilder("content.parent").startSpan();
        Span child = tracer.spanBuilder(name)
                .setParent(Context.current().with(parent))
                .setSpanKind(kind)
                .addLink(parent.getSpanContext(), Attributes.builder()
                        .put("email", "link-person@example.com")
                        .put("content.collection", "article")
                        .build())
                .startSpan();
        if (richAttributes) {
            child.setAttribute("content.collection", "articles");
            child.setAttribute("operation", "content.resource.read");
            child.setAttribute("http.request.method", "GET");
            child.setAttribute("http.response.status_code", 503L);
            child.setAttribute("cache.hit", true);
            child.setAttribute("http.url", "https://user:secret@example.test/path?key=value");
            child.setAttribute("db.statement", "select * from articles where id='private'");
            child.setAttribute("client.address", "203.0.113.88");
        }
        if (error) {
            String message = "database timeout for person@example.com token=" + INGEST_KEY + " at 203.0.113.88";
            child.setStatus(StatusCode.ERROR, "Could not load article: token=" + INGEST_KEY);
            IllegalStateException exception = new IllegalStateException(message);
            exception.setStackTrace(new StackTraceElement[] {
                    new StackTraceElement("com.jtdev.website.service.ContentService", "load", "ContentService.java", 42)
            });
            child.recordException(exception);
        }
        child.end();
        parent.end();
        List<SpanData> finished = exporter.getFinishedSpanItems();
        SpanData span = finished.stream().filter(item -> name.equals(item.getName())).findFirst().orElseThrow();
        provider.close();
        return span;
    }

    private static void assertRedacted(String input, String... secrets) {
        assertNotNull(input);
        for (String secret : secrets) {
            assertFalse(input.contains(secret), "A sensitive value remained in exported telemetry");
        }
    }

    private static final class TestLogRecord implements LogRecordData {
        private final String body;
        private final Severity severity;
        private final String severityText;
        private final long timestamp;
        private final long observedTimestamp;
        private final SpanContext spanContext;
        private final Attributes attributes;
        private final Resource resource;
        private final InstrumentationScopeInfo scope;
        private final String eventName;

        private TestLogRecord(
                String body,
                Severity severity,
                String severityText,
                long timestamp,
                long observedTimestamp,
                SpanContext spanContext,
                Attributes attributes,
                Resource resource,
                InstrumentationScopeInfo scope,
                String eventName) {
            this.body = body;
            this.severity = severity;
            this.severityText = severityText;
            this.timestamp = timestamp;
            this.observedTimestamp = observedTimestamp;
            this.spanContext = spanContext;
            this.attributes = attributes;
            this.resource = resource;
            this.scope = scope;
            this.eventName = eventName;
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
            return timestamp;
        }

        @Override
        public long getObservedTimestampEpochNanos() {
            return observedTimestamp;
        }

        @Override
        public SpanContext getSpanContext() {
            return spanContext;
        }

        @Override
        public Severity getSeverity() {
            return severity;
        }

        @Override
        public String getSeverityText() {
            return severityText;
        }

        @Override
        public Body getBody() {
            return Body.string(body);
        }

        @Override
        public io.opentelemetry.api.common.Value<?> getBodyValue() {
            return io.opentelemetry.api.common.Value.of(body);
        }

        @Override
        public Attributes getAttributes() {
            return attributes;
        }

        @Override
        public int getTotalAttributeCount() {
            return attributes.size();
        }

        @Override
        public String getEventName() {
            return eventName;
        }
    }
}
