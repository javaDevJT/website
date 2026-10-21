package com.jtdev.website.observability;

import com.jtdev.website.WebsiteApplication;
import com.jtdev.website.service.ContentService;
import com.sun.net.httpserver.HttpServer;
import io.micrometer.registry.otlp.OtlpMeterRegistry;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.instrumentation.logback.appender.v1_0.OpenTelemetryAppender;
import io.opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest;
import io.opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest;
import io.opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest;
import io.opentelemetry.proto.logs.v1.LogRecord;
import io.opentelemetry.proto.logs.v1.SeverityNumber;
import io.opentelemetry.proto.metrics.v1.AggregationTemporality;
import io.opentelemetry.sdk.logs.SdkLoggerProvider;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.SpanExporter;
import io.opentelemetry.sdk.logs.export.LogRecordExporter;
import io.opentelemetry.sdk.trace.samplers.Sampler;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.micrometer.tracing.opentelemetry.autoconfigure.SdkTracerProviderBuilderCustomizer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/** Controlled local fixture: no request in this class reaches OpenWoof or TrueNAS. */
class OpenWoofExportPipelineTest {
    private static final String KEY = "fixture-only-private-ingest-value";
    private static final String VERSION = "a".repeat(40);
    private static String fixtureOrigin;
    @TempDir Path directory;

    @Test
    void nativeProvidersBridgeOriginalLogsAndRealOperationsThroughOtlpProtobuf() throws Exception {
        var traces = new ConcurrentLinkedQueue<ExportTraceServiceRequest>();
        var logs = new ConcurrentLinkedQueue<ExportLogsServiceRequest>();
        var metrics = new ConcurrentLinkedQueue<ExportMetricsServiceRequest>();
        var headers = new ConcurrentLinkedQueue<List<String>>();
        var contentTypes = new ConcurrentLinkedQueue<String>();
        var receiverStatus = new AtomicInteger(200);
        var rejectedExports = new AtomicInteger();
        HttpServer receiver = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        receiver.createContext("/v1/traces", exchange -> {
            headers.add(List.copyOf(exchange.getRequestHeaders().get("Authorization")));
            contentTypes.add(exchange.getRequestHeaders().getFirst("Content-Type"));
            traces.add(ExportTraceServiceRequest.parseFrom(exchange.getRequestBody()));
            exchange.getResponseHeaders().set("Content-Type", "application/x-protobuf");
            if (receiverStatus.get() != 200) rejectedExports.incrementAndGet();
            exchange.sendResponseHeaders(receiverStatus.get(), -1);
            exchange.close();
        });
        receiver.createContext("/v1/logs", exchange -> {
            headers.add(List.copyOf(exchange.getRequestHeaders().get("Authorization")));
            contentTypes.add(exchange.getRequestHeaders().getFirst("Content-Type"));
            logs.add(ExportLogsServiceRequest.parseFrom(exchange.getRequestBody()));
            exchange.getResponseHeaders().set("Content-Type", "application/x-protobuf");
            if (receiverStatus.get() != 200) rejectedExports.incrementAndGet();
            exchange.sendResponseHeaders(receiverStatus.get(), -1);
            exchange.close();
        });
        receiver.createContext("/v1/metrics", exchange -> {
            headers.add(List.copyOf(exchange.getRequestHeaders().get("Authorization")));
            contentTypes.add(exchange.getRequestHeaders().getFirst("Content-Type"));
            metrics.add(ExportMetricsServiceRequest.parseFrom(exchange.getRequestBody()));
            exchange.getResponseHeaders().set("Content-Type", "application/x-protobuf");
            if (receiverStatus.get() != 200) rejectedExports.incrementAndGet();
            exchange.sendResponseHeaders(receiverStatus.get(), -1);
            exchange.close();
        });
        receiver.start();
        fixtureOrigin = "http://127.0.0.1:" + receiver.getAddress().getPort();
        Path secret = Files.writeString(directory.resolve("ingest.fixture"), KEY);
        Files.setPosixFilePermissions(secret, PosixFilePermissions.fromString("rw-------"));
        SpringApplication application = new SpringApplication(WebsiteApplication.class, FixtureExport.class);
        application.setDefaultProperties(Map.of(
                "spring.main.web-application-type", "reactive",
                "server.port", "0",
                "openwoof.telemetry.enabled", "true",
                "OPENWOOF_INGEST_KEY_FILE", secret.toString(),
                "QB_SOURCE_COMMIT", VERSION));
        try (var context = application.run()) {
            assertEquals(1, context.getBeansOfType(SdkTracerProvider.class).size());
            assertEquals(1, context.getBeansOfType(SdkLoggerProvider.class).size());
            assertEquals(1, context.getBeansOfType(SpanExporter.class).size());
            assertEquals(1, context.getBeansOfType(LogRecordExporter.class).size());
            int applicationPort = context.getEnvironment().getRequiredProperty("local.server.port", Integer.class);
            try (var client = HttpClient.newHttpClient()) {
                for (String path : List.of("/api/content/portfolio/list", "/api/blog", "/actuator/health")) {
                    var response = client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + applicationPort + path))
                            .timeout(java.time.Duration.ofSeconds(10)).GET().build(), HttpResponse.BodyHandlers.discarding());
                    assertEquals(200, response.statusCode(), path);
                }
            }
            var sdk = context.getBean(OpenTelemetry.class);
            var content = context.getBean(ContentService.class);
            var originalError = ContentService.class.getDeclaredMethod("logMetadataFailure",
                    WebsiteOperations.ContentCollection.class, Object.class, Exception.class);
            originalError.setAccessible(true);
            Span request = sdk.getTracer("website.fixture").spanBuilder("fixture.content.request").startSpan();
            try (var ignored = request.makeCurrent()) {
                assertEquals(9, content.getPortfolioList().size());
                originalError.invoke(null, WebsiteOperations.ContentCollection.BLOG, "fixture.md",
                        new IOException("invalid metadata for person@example.test Authorization=Bearer " + KEY));
            } finally {
                request.end();
            }
            // The same actual logger path also survives without an active trace.
            originalError.invoke(null, WebsiteOperations.ContentCollection.PORTFOLIO, "fixture.md",
                    new IOException("invalid isolated fixture metadata"));
            assertTrue(context.getBean(SdkTracerProvider.class).forceFlush().join(10, TimeUnit.SECONDS).isSuccess());
            assertTrue(context.getBean(SdkLoggerProvider.class).forceFlush().join(10, TimeUnit.SECONDS).isSuccess());
            var registry = context.getBean(OtlpMeterRegistry.class);
            var publish = OtlpMeterRegistry.class.getDeclaredMethod("publish");
            publish.setAccessible(true);
            publish.invoke(registry);

            var spanRecords = traces.stream().flatMap(message -> message.getResourceSpansList().stream())
                    .flatMap(resource -> resource.getScopeSpansList().stream())
                    .flatMap(scope -> scope.getSpansList().stream()).toList();
            var catalogue = spanRecords.stream().filter(span -> span.getName().equals("content.catalogue.list"))
                    .filter(span -> hex(span.getTraceId().toByteArray()).equals(request.getSpanContext().getTraceId()))
                    .findFirst().orElseThrow();
            assertEquals(request.getSpanContext().getTraceId(), hex(catalogue.getTraceId().toByteArray()));
            assertEquals(request.getSpanContext().getSpanId(), hex(catalogue.getParentSpanId().toByteArray()));
            assertTrue(spanRecords.stream().anyMatch(span -> span.getName().equals("content.resource.read")));
            assertTrue(spanRecords.stream().anyMatch(span -> span.getKind()
                    == io.opentelemetry.proto.trace.v1.Span.SpanKind.SPAN_KIND_SERVER));
            var database = spanRecords.stream().filter(span -> span.getName().equals("blog.database.list"))
                    .findFirst().orElseThrow();
            assertEquals(io.opentelemetry.proto.trace.v1.Span.SpanKind.SPAN_KIND_CLIENT, database.getKind());
            assertTrue(spanRecords.stream().anyMatch(span -> span.getSpanId().equals(database.getParentSpanId())),
                    "bounded-elastic repository work must keep the real HTTP parent context");
            assertFalse(spanRecords.stream().anyMatch(span -> span.getName().contains("/actuator/health")));

            var originalLogs = new ArrayList<LogRecord>();
            logs.forEach(message -> message.getResourceLogsList().forEach(resource -> {
                assertIdentity(resource.getResource().getAttributesList());
                resource.getScopeLogsList().forEach(scope -> {
                    if (scope.getScope().getName().equals(ContentService.class.getName())) {
                        originalLogs.addAll(scope.getLogRecordsList());
                    }
                });
            }));
            assertEquals(2, originalLogs.size());
            var warning = originalLogs.stream().filter(record -> record.getBody().getStringValue().contains("blog metadata"))
                    .findFirst().orElseThrow();
            assertTrue(warning.getBody().getStringValue().startsWith("Error parsing blog metadata for fixture.md: invalid metadata"));
            assertFalse(warning.toString().contains(KEY));
            assertFalse(warning.toString().contains("person@example.test"));
            assertEquals(SeverityNumber.SEVERITY_NUMBER_WARN, warning.getSeverityNumber());
            assertTrue(warning.getTimeUnixNano() > 0);
            assertEquals(request.getSpanContext().getTraceId(), hex(warning.getTraceId().toByteArray()));
            assertTrue(warning.getAttributesList().stream().anyMatch(attribute -> attribute.getKey().equals("content.collection")
                    && attribute.getValue().getStringValue().equals("blog")));
            assertTrue(warning.getAttributesList().stream().anyMatch(attribute -> attribute.getKey().equals("exception.stacktrace")
                    && attribute.getValue().getStringValue().contains("java.io.IOException")));
            assertTrue(originalLogs.stream().anyMatch(record -> record.getTraceId().isEmpty()));
            assertTrue(logs.stream().flatMap(message -> message.getResourceLogsList().stream())
                    .flatMap(resource -> resource.getScopeLogsList().stream())
                    .flatMap(scope -> scope.getLogRecordsList().stream())
                    .anyMatch(record -> record.getBody().getStringValue().contains("Started")
                            && record.getBody().getStringValue().contains("in")), "real startup records must survive early buffering");

            var operationMetrics = metrics.stream().flatMap(message -> message.getResourceMetricsList().stream())
                    .peek(resource -> assertIdentity(resource.getResource().getAttributesList()))
                    .flatMap(resource -> resource.getScopeMetricsList().stream())
                    .flatMap(scope -> scope.getMetricsList().stream())
                    .filter(metric -> metric.getName().equals("website.operation.duration")).toList();
            assertFalse(operationMetrics.isEmpty(), "actual operation durations must reach OTLP");
            operationMetrics.forEach(metric -> {
                assertEquals("seconds", metric.getUnit());
                assertTrue(metric.hasHistogram());
                assertEquals(AggregationTemporality.AGGREGATION_TEMPORALITY_CUMULATIVE,
                        metric.getHistogram().getAggregationTemporality());
                assertTrue(metric.getHistogram().getDataPointsList().stream().anyMatch(point -> point.getCount() > 0));
            });
            assertFalse(headers.isEmpty());
            assertTrue(headers.stream().allMatch(value -> value.equals(List.of("Bearer " + KEY))));
            assertTrue(contentTypes.stream().allMatch(value -> value.startsWith("application/x-protobuf")));
            // Flushing the batches leaves the same providers available for ongoing export.
            assertEquals(9, content.getPortfolioList().size());
            assertTrue(context.getBean(SdkTracerProvider.class).forceFlush().join(10, TimeUnit.SECONDS).isSuccess());

            // A controlled receiver failure must leave actual application work
            // and its original logger usable. This never targets production.
            receiverStatus.set(500);
            assertEquals(9, content.getPortfolioList().size());
            originalError.invoke(null, WebsiteOperations.ContentCollection.BLOG, "fixture.md",
                    new IOException("isolated receiver failure coverage"));
            context.getBean(SdkTracerProvider.class).forceFlush().join(10, TimeUnit.SECONDS);
            context.getBean(SdkLoggerProvider.class).forceFlush().join(10, TimeUnit.SECONDS);
            publish.invoke(registry);
            assertTrue(rejectedExports.get() >= 3, "all three real exporters must encounter the fixture failure");
            try (var client = HttpClient.newHttpClient()) {
                var response = client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"
                                + applicationPort + "/api/content/portfolio/list"))
                        .timeout(java.time.Duration.ofSeconds(10)).GET().build(), HttpResponse.BodyHandlers.discarding());
                assertEquals(200, response.statusCode(), "export failure must not break the serving app");
            }
            receiverStatus.set(200);
            assertTrue(context.getBean(SdkTracerProvider.class).forceFlush().join(10, TimeUnit.SECONDS).isSuccess());
        } finally {
            OpenTelemetryAppender.install(OpenTelemetry.noop());
            receiver.stop(0);
        }
    }

    private static void assertIdentity(List<io.opentelemetry.proto.common.v1.KeyValue> attributes) {
        var identity = OpenWoofEnvironmentPostProcessor.identity(VERSION);
        identity.forEach((key, value) -> assertTrue(attributes.stream().anyMatch(attribute ->
                attribute.getKey().equals(key) && attribute.getValue().getStringValue().equals(value)), key));
    }

    private static String hex(byte[] bytes) {
        return java.util.HexFormat.of().formatHex(bytes);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FixtureExport {
        @Bean @Primary
        OpenWoofTelemetryConfiguration.RuntimeSettings fixtureRuntimeSettings() {
            return new OpenWoofTelemetryConfiguration.RuntimeSettings(fixtureOrigin, KEY,
                    OpenWoofEnvironmentPostProcessor.identity(VERSION));
        }

        @Bean
        SdkTracerProviderBuilderCustomizer fixtureSampler() {
            return builder -> builder.setSampler(Sampler.alwaysOn());
        }
    }
}
