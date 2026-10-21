package com.jtdev.website.observability;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Adapts the standard OTLP inputs to Boot's native exporters before binding. */
public final class OpenWoofEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {
    static final String ENDPOINT = "https://openwoof.javadevjt.tech";
    static final String SERVICE = "website-backend";
    static final String NAMESPACE = "personal-website";
    static final String ENVIRONMENT = "production";

    @Override
    public int getOrder() {
        // Config data must be loaded; exporters and Logback have not started yet.
        return Ordered.HIGHEST_PRECEDENCE + 20;
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Map<String, Object> properties = new LinkedHashMap<>();
        String enabled = environment.getProperty("openwoof.telemetry.enabled", "false");
        if (!Set.of("true", "false").contains(enabled)) {
            throw new IllegalStateException("OpenWoof telemetry enablement must be true or false");
        }
        properties.put("openwoof.telemetry.enabled", enabled);
        boolean active = Boolean.parseBoolean(enabled);
        properties.put("management.opentelemetry.enabled", active);
        properties.put("management.otlp.metrics.export.enabled", active);
        properties.put("management.tracing.export.otlp.enabled", active);
        if (active) {
            validateEndpoint(environment.getProperty("OTEL_EXPORTER_OTLP_ENDPOINT", ENDPOINT));
            if (!"http/protobuf".equals(environment.getProperty("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf"))) {
                throw new IllegalStateException("OpenWoof requires OTLP HTTP/protobuf");
            }
            String version = environment.getProperty("QB_SOURCE_COMMIT", "unknown");
            if (!version.matches("[0-9a-f]{40}")) {
                throw new IllegalStateException("OpenWoof requires the image's full source commit identity");
            }
            // Validate the actual custom file input now. Never put its contents in
            // the Spring Environment, a command argument, or an environment variable.
            readKey(environment.getProperty("OPENWOOF_INGEST_KEY_FILE"));
            properties.put("OTEL_SERVICE_NAME", SERVICE);
            properties.put("OTEL_EXPORTER_OTLP_ENDPOINT", ENDPOINT);
            properties.put("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf");
            properties.put("OTEL_EXPORTER_OTLP_HEADERS", "");
            for (String signal : Set.of("TRACES", "METRICS", "LOGS")) {
                properties.put("OTEL_EXPORTER_OTLP_" + signal + "_ENDPOINT", ENDPOINT + "/v1/" + signal.toLowerCase(java.util.Locale.ROOT));
                properties.put("OTEL_EXPORTER_OTLP_" + signal + "_PROTOCOL", "http/protobuf");
                properties.put("OTEL_EXPORTER_OTLP_" + signal + "_HEADERS", "");
            }
            Map<String, String> identity = identity(version);
            identity.forEach((key, value) -> properties.put("management.opentelemetry.resource-attributes[" + key + "]", value));
            properties.put("OTEL_RESOURCE_ATTRIBUTES", identity.entrySet().stream()
                    .map(entry -> entry.getKey() + "=" + entry.getValue()).collect(java.util.stream.Collectors.joining(",")));
            properties.put("management.opentelemetry.tracing.export.otlp.endpoint", ENDPOINT + "/v1/traces");
            properties.put("management.opentelemetry.tracing.export.otlp.transport", "http");
            properties.put("management.opentelemetry.logging.export.otlp.endpoint", ENDPOINT + "/v1/logs");
            properties.put("management.opentelemetry.logging.export.otlp.transport", "http");
            properties.put("management.otlp.metrics.export.url", ENDPOINT + "/v1/metrics");
            properties.put("spring.reactor.context-propagation", "auto");
            // Parent based: respect an upstream sampling decision. Local roots use
            // a deliberate 25% budget; real trace-context propagation remains intact.
            properties.put("management.tracing.sampling.probability", "0.25");
            properties.put("management.opentelemetry.tracing.export.max-queue-size", "512");
            properties.put("management.opentelemetry.tracing.export.max-batch-size", "64");
            properties.put("management.opentelemetry.tracing.export.schedule-delay", "5s");
            properties.put("management.opentelemetry.tracing.export.timeout", "5s");
            properties.put("management.opentelemetry.logging.export.max-queue-size", "512");
            properties.put("management.opentelemetry.logging.export.max-batch-size", "64");
            properties.put("management.opentelemetry.logging.export.schedule-delay", "5s");
            properties.put("management.opentelemetry.logging.export.timeout", "5s");
            properties.put("management.opentelemetry.logging.limits.max-attributes", "64");
            properties.put("management.opentelemetry.logging.limits.max-attribute-value-length", "16384");
        }
        environment.getPropertySources().addFirst(new MapPropertySource("websiteOpenWoofRuntime", properties));
    }

    static void validateEndpoint(String candidate) {
        try {
            URI uri = URI.create(candidate);
            if (!"https".equals(uri.getScheme()) || !"openwoof.javadevjt.tech".equals(uri.getHost())
                    || uri.getPort() != -1 || uri.getUserInfo() != null || uri.getQuery() != null
                    || uri.getFragment() != null || !(uri.getPath().isEmpty() || "/".equals(uri.getPath()))) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new IllegalStateException("OpenWoof endpoint must be its verified HTTPS base origin");
        }
    }

    static Map<String, String> identity(String version) {
        return Map.of("service.name", SERVICE, "service.namespace", NAMESPACE,
                "deployment.environment.name", ENVIRONMENT, "service.version", version);
    }

    static String readKey(String filename) {
        if (filename == null || filename.isBlank()) {
            throw new IllegalStateException("OpenWoof ingest key file is required when telemetry is enabled");
        }
        byte[] bytes = null;
        try {
            Path path = Path.of(filename);
            if (!Files.isRegularFile(path) || Files.size(path) > 4096) throw new IllegalArgumentException();
            Set<PosixFilePermission> mode = Files.getPosixFilePermissions(path);
            if (mode.stream().anyMatch(permission -> permission.name().startsWith("GROUP_")
                    || permission.name().startsWith("OTHERS_"))) throw new IllegalArgumentException();
            bytes = Files.readAllBytes(path);
            String key = new String(bytes, StandardCharsets.UTF_8).strip();
            if (key.isEmpty() || !key.matches("[\\x21-\\x7E]+")) throw new IllegalArgumentException();
            return key;
        } catch (Exception exception) {
            // Do not propagate key material or arbitrary filesystem/parser text.
            throw new IllegalStateException("OpenWoof ingest key file must be readable, nonempty, and owner-only");
        } finally {
            if (bytes != null) java.util.Arrays.fill(bytes, (byte) 0);
        }
    }
}
