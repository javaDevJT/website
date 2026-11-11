package com.jtdev.website.observability;

import com.jtdev.website.WebsiteApplication;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.micrometer.registry.otlp.OtlpMeterRegistry;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest;
import io.opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest;
import io.opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest;
import io.opentelemetry.sdk.logs.SdkLoggerProvider;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.micrometer.tracing.opentelemetry.autoconfigure.SdkTracerProviderBuilderCustomizer;
import org.springframework.beans.factory.support.AbstractBeanDefinition;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.TimeUnit;

/**
 * Starts the packaged application's runtime class path with opt-in telemetry.
 * This class is only copied to a temporary loader path by the smoke script.
 */
public final class PackagedRuntimeTelemetrySmoke {
    private static final String VERSION = "a".repeat(40);
    private static final String KEY = "packaged-runtime-smoke-fixture-key";
    private static final String RESOURCE_EMAIL = "resource-person@example.net";
    private static final String FILTERED_EMAIL = "filtered-person@example.net";
    private static final String TRACE_EMAIL = "trace-person@example.net";
    private static final String LOG_EMAIL = "log-person@example.net";
    private static final ConcurrentLinkedQueue<ReceivedExport> EXPORTS = new ConcurrentLinkedQueue<>();
    private static volatile String fixtureOrigin;

    private PackagedRuntimeTelemetrySmoke() {}

    public static void main(String[] args) throws Exception {
        Path keyFile = Files.createTempFile("website-telemetry-fixture-", ".key");
        Files.writeString(keyFile, KEY, StandardCharsets.UTF_8);
        Files.setPosixFilePermissions(keyFile, PosixFilePermissions.fromString("rw-------"));
        HttpServer receiver = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        receiver.createContext("/v1/traces", PackagedRuntimeTelemetrySmoke::receive);
        receiver.createContext("/v1/logs", PackagedRuntimeTelemetrySmoke::receive);
        receiver.createContext("/v1/metrics", PackagedRuntimeTelemetrySmoke::receive);
        receiver.start();
        fixtureOrigin = "http://127.0.0.1:" + receiver.getAddress().getPort();

        try {
            ConfigurableEnvironment environment = new StandardEnvironment();
            environment.getPropertySources().addFirst(new MapPropertySource("packagedTelemetrySmoke", Map.of(
                    "openwoof.telemetry.enabled", "true",
                    "OPENWOOF_INGEST_KEY_FILE", keyFile.toString(),
                    "QB_SOURCE_COMMIT", VERSION,
                    "spring.main.web-application-type", "reactive",
                    "server.port", "0")));
            SpringApplication application = new SpringApplication(WebsiteApplication.class);
            application.setEnvironment(environment);
            application.addInitializers(context -> context.addBeanFactoryPostProcessor(beanFactory -> {
                AbstractBeanDefinition settings = (AbstractBeanDefinition)
                        beanFactory.getBeanDefinition("openWoofRuntimeSettings");
                settings.setPrimary(true);
                settings.setInstanceSupplier(() -> new OpenWoofTelemetryConfiguration.RuntimeSettings(fixtureOrigin,
                        KEY, OpenWoofEnvironmentPostProcessor.identity(VERSION)));
                ((DefaultListableBeanFactory) beanFactory).registerSingleton("packagedRuntimeFixtureSampler",
                        (SdkTracerProviderBuilderCustomizer) builder -> builder.setSampler(
                                io.opentelemetry.sdk.trace.samplers.Sampler.alwaysOn()));
            }));

            try (var context = application.run()) {
                context.getBean(SdkTracerProvider.class);
                context.getBean(SdkLoggerProvider.class);
                context.getBean(OtlpMeterRegistry.class);

                int port = context.getEnvironment().getRequiredProperty("local.server.port", Integer.class);
                HttpRequest request = HttpRequest.newBuilder(URI.create(
                                "http://127.0.0.1:" + port + "/api/content/portfolio/list"))
                        .timeout(Duration.ofSeconds(15)).GET().build();
                HttpResponse<String> response = HttpClient.newHttpClient().send(request,
                        HttpResponse.BodyHandlers.ofString());
                require(response.statusCode() == 200, "packaged application content read returned " + response.statusCode());
                require(!response.body().isBlank(), "packaged application content read returned an empty body");

                OpenTelemetry telemetry = context.getBean(OpenTelemetry.class);
                Span span = telemetry.getTracer("website.packaged-runtime-smoke")
                        .spanBuilder("packaged.runtime.smoke").startSpan();
                span.setAttribute("fixture.trace", TRACE_EMAIL);
                span.end();
                LoggerFactory.getLogger(PackagedRuntimeTelemetrySmoke.class)
                        .warn("packaged runtime telemetry fixture email={}", LOG_EMAIL);

                OtlpMeterRegistry registry = context.getBean(OtlpMeterRegistry.class);
                registry.counter("packaged.runtime.smoke").increment();
                var publish = OtlpMeterRegistry.class.getDeclaredMethod("publish");
                publish.setAccessible(true);
                publish.invoke(registry);
                require(context.getBean(SdkTracerProvider.class).forceFlush()
                                .join(10, TimeUnit.SECONDS).isSuccess(), "trace exporter did not flush");
                require(context.getBean(SdkLoggerProvider.class).forceFlush()
                                .join(10, TimeUnit.SECONDS).isSuccess(), "log exporter did not flush");

                long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
                while (EXPORTS.size() < 3 && System.nanoTime() < deadline) Thread.sleep(25);
                for (String signal : List.of("traces", "logs", "metrics")) {
                    ReceivedExport exported = EXPORTS.stream()
                            .filter(item -> item.path().equals("/v1/" + signal))
                            .findFirst().orElseThrow(() -> new IllegalStateException(
                                    "packaged runtime did not deliver " + signal + " to the local fixture"));
                    require(exported.bodyBytes() > 0, signal + " export body was empty");
                    require(exported.contentType() != null && exported.contentType().startsWith("application/x-protobuf"),
                            signal + " export did not use OTLP protobuf");
                    require(exported.authorization().equals("Bearer " + KEY),
                            signal + " export did not use the harmless fixture key");
                    require(exported.bodyText().contains("host.name")
                                    && exported.bodyText().contains("website-smoke-host"),
                            signal + " export lost the safe host.name resource tag");
                    require(exported.bodyText().contains("fixture.safe")
                                    && exported.bodyText().contains("packaged-safe-tag"),
                            signal + " export lost the safe custom resource tag");
                    require(exported.bodyText().contains("fixture.contact")
                                    && exported.bodyText().contains("[REDACTED]"),
                            signal + " export did not redact the safe-key resource value");
                    require(!exported.bodyText().contains(RESOURCE_EMAIL)
                                    && !exported.bodyText().contains(FILTERED_EMAIL)
                                    && !exported.bodyText().contains("user.email"),
                            signal + " export leaked or retained a filtered resource value");
                    if (signal.equals("traces")) {
                        require(exported.fixtureTraceRedacted(),
                                "trace export lost the fixture span or its redacted attribute");
                        require(!exported.bodyText().contains(TRACE_EMAIL),
                                "trace export leaked a private span attribute");
                    }
                    if (signal.equals("logs")) {
                        require(exported.fixtureLogRedacted(),
                                "log export lost the fixture record or its redacted message");
                        require(!exported.bodyText().contains(LOG_EMAIL),
                                "log export leaked a private log body value");
                    }
                }
            } finally {
                io.opentelemetry.instrumentation.logback.appender.v1_0.OpenTelemetryAppender.install(OpenTelemetry.noop());
            }
            System.out.println("PACKAGED_TELEMETRY_SMOKE_OK runtime=packaged-jar receiver=loopback "
                    + "signals=traces,logs,metrics content_read=200");
        } finally {
            receiver.stop(0);
            Files.deleteIfExists(keyFile);
        }
    }

    private static void receive(HttpExchange exchange) throws IOException {
        byte[] body = exchange.getRequestBody().readAllBytes();
        boolean fixtureTraceRedacted = false;
        boolean fixtureLogRedacted = false;
        String bodyText = switch (exchange.getRequestURI().getPath()) {
            case "/v1/traces" -> {
                var request = ExportTraceServiceRequest.parseFrom(body);
                fixtureTraceRedacted = request.getResourceSpansList().stream()
                        .flatMap(resource -> resource.getScopeSpansList().stream())
                        .flatMap(scope -> scope.getSpansList().stream())
                        .anyMatch(span -> span.getName().equals("packaged.runtime.smoke")
                                && span.getAttributesList().stream().anyMatch(attribute ->
                                attribute.getKey().equals("fixture.trace")
                                        && attribute.getValue().getStringValue().equals("[REDACTED]")));
                yield request.toString();
            }
            case "/v1/logs" -> {
                var request = ExportLogsServiceRequest.parseFrom(body);
                fixtureLogRedacted = request.getResourceLogsList().stream()
                        .flatMap(resource -> resource.getScopeLogsList().stream())
                        .flatMap(scope -> scope.getLogRecordsList().stream())
                        .anyMatch(record -> record.getBody().getStringValue()
                                .equals("packaged runtime telemetry fixture email=[REDACTED]"));
                yield request.toString();
            }
            case "/v1/metrics" -> ExportMetricsServiceRequest.parseFrom(body).toString();
            default -> throw new IOException("unexpected packaged telemetry signal path");
        };
        EXPORTS.add(new ReceivedExport(exchange.getRequestURI().getPath(),
                exchange.getRequestHeaders().getFirst("Content-Type"),
                exchange.getRequestHeaders().getFirst("Authorization"), body.length, bodyText,
                fixtureTraceRedacted, fixtureLogRedacted));
        exchange.getResponseHeaders().set("Content-Type", "application/x-protobuf");
        exchange.sendResponseHeaders(200, -1);
        exchange.close();
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalStateException(message);
    }

    private record ReceivedExport(String path, String contentType, String authorization,
                                  int bodyBytes, String bodyText,
                                  boolean fixtureTraceRedacted, boolean fixtureLogRedacted) {}

}
