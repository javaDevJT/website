package com.jtdev.website.observability;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class OpenWoofEnvironmentPostProcessorTest {
    @TempDir Path directory;

    @Test
    void disabledExportNeedsNoSecretAndDisablesAllNativeExporters() {
        var environment = environment(Map.of());
        process(environment);
        assertEquals("false", environment.getProperty("management.opentelemetry.enabled"));
        assertEquals("false", environment.getProperty("management.otlp.metrics.export.enabled"));
        assertEquals("false", environment.getProperty("management.tracing.export.otlp.enabled"));
    }

    @Test
    void enabledExportBindsOneIdentityAndNeverStoresTheKeyInTheEnvironment() throws Exception {
        String key = "fixture-private-ingest-value";
        var environment = environment(enabled(key));
        process(environment);
        assertEquals("true", environment.getProperty("management.opentelemetry.enabled"));
        assertEquals("http/protobuf", environment.getProperty("OTEL_EXPORTER_OTLP_PROTOCOL"));
        assertEquals("", environment.getProperty("OTEL_EXPORTER_OTLP_HEADERS"));
        assertEquals("", environment.getProperty("OTEL_EXPORTER_OTLP_LOGS_HEADERS"));
        assertEquals("https://openwoof.javadevjt.tech/v1/traces",
                environment.getProperty("management.opentelemetry.tracing.export.otlp.endpoint"));
        assertEquals("https://openwoof.javadevjt.tech/v1/logs",
                environment.getProperty("management.opentelemetry.logging.export.otlp.endpoint"));
        assertEquals("https://openwoof.javadevjt.tech/v1/metrics",
                environment.getProperty("management.otlp.metrics.export.url"));
        var source = (MapPropertySource) environment.getPropertySources().get("websiteOpenWoofRuntime");
        assertNotNull(source);
        assertFalse(source.getSource().values().stream().anyMatch(value -> value.toString().contains(key)));
        assertEquals("website-backend", environment.getProperty(
                "management.opentelemetry.resource-attributes[service.name]"));
        assertEquals("a".repeat(40), environment.getProperty(
                "management.opentelemetry.resource-attributes[service.version]"));
        var settings = new OpenWoofTelemetryConfiguration().openWoofRuntimeSettings(environment);
        assertEquals(Map.of("Authorization", "Bearer " + key), settings.headers());
        assertFalse(settings.toString().contains(key));
        var metrics = new OpenWoofTelemetryConfiguration().websiteMetricExportConfig(settings);
        assertEquals(settings.headers(), metrics.headers());
        assertEquals(settings.identity, metrics.resourceAttributes());
        assertEquals(java.util.concurrent.TimeUnit.SECONDS, metrics.baseTimeUnit());
        assertEquals(io.micrometer.registry.otlp.AggregationTemporality.CUMULATIVE, metrics.aggregationTemporality());
    }

    @Test
    void exportRefusesMissingEmptyBroadlyReadableOrHeaderShapedKeysWithoutRevealingThem() throws Exception {
        var missing = enabled("valid-fixture");
        missing.put("OPENWOOF_INGEST_KEY_FILE", directory.resolve("absent").toString());
        assertThrows(IllegalStateException.class, () -> process(environment(missing)));
        for (String invalid : new String[]{"", "Bearer private-value", "private\nvalue"}) {
            var exception = assertThrows(IllegalStateException.class, () -> process(environment(enabled(invalid))));
            assertFalse(exception.toString().contains("private-value"));
            assertNull(exception.getCause());
        }
        var broad = enabled("private-fixture");
        Files.setPosixFilePermissions(Path.of((String) broad.get("OPENWOOF_INGEST_KEY_FILE")),
                PosixFilePermissions.fromString("rw-r--r--"));
        assertThrows(IllegalStateException.class, () -> process(environment(broad)));
    }

    @Test
    void exportRefusesConflictingOriginProtocolAndUnknownImageIdentity() throws Exception {
        for (String endpoint : new String[]{"http://openwoof.javadevjt.tech", "https://other.invalid",
                "https://openwoof.javadevjt.tech/api/v1", "https://user:password@openwoof.javadevjt.tech",
                "https://openwoof.javadevjt.tech?key=secret"}) {
            var properties = enabled("valid-fixture");
            properties.put("OTEL_EXPORTER_OTLP_ENDPOINT", endpoint);
            assertThrows(IllegalStateException.class, () -> process(environment(properties)));
        }
        var protocol = enabled("valid-fixture");
        protocol.put("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc");
        assertThrows(IllegalStateException.class, () -> process(environment(protocol)));
        var unknown = enabled("valid-fixture");
        unknown.put("QB_SOURCE_COMMIT", "unknown");
        assertThrows(IllegalStateException.class, () -> process(environment(unknown)));
    }

    private Map<String, Object> enabled(String key) throws Exception {
        Path file = Files.createTempFile(directory, "key", ".fixture");
        Files.writeString(file, key);
        Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"));
        Map<String, Object> properties = new HashMap<>();
        properties.put("openwoof.telemetry.enabled", "true");
        properties.put("OPENWOOF_INGEST_KEY_FILE", file.toString());
        properties.put("QB_SOURCE_COMMIT", "a".repeat(40));
        properties.put("OTEL_EXPORTER_OTLP_HEADERS", "X-API-Key=conflicting-fixture");
        properties.put("OTEL_EXPORTER_OTLP_LOGS_HEADERS", "X-API-Key=conflicting-fixture");
        return properties;
    }

    private StandardEnvironment environment(Map<String, Object> properties) {
        var environment = new StandardEnvironment();
        environment.getPropertySources().addFirst(new MapPropertySource("fixture", properties));
        return environment;
    }

    private void process(StandardEnvironment environment) {
        new OpenWoofEnvironmentPostProcessor().postProcessEnvironment(environment, new SpringApplication());
    }
}
