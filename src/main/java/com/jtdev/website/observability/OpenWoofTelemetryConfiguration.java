package com.jtdev.website.observability;

import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.config.MeterFilter;
import io.micrometer.observation.ObservationPredicate;
import io.micrometer.registry.otlp.AggregationTemporality;
import io.micrometer.registry.otlp.OtlpConfig;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.exporter.otlp.http.logs.OtlpHttpLogRecordExporter;
import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.instrumentation.logback.appender.v1_0.OpenTelemetryAppender;
import io.opentelemetry.sdk.common.CompletableResultCode;
import io.opentelemetry.sdk.common.export.RetryPolicy;
import io.opentelemetry.sdk.logs.data.LogRecordData;
import io.opentelemetry.sdk.logs.export.LogRecordExporter;
import io.opentelemetry.sdk.trace.data.SpanData;
import io.opentelemetry.sdk.trace.export.SpanExporter;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.server.reactive.observation.ServerRequestObservationContext;

import java.time.Duration;
import java.util.Collection;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "openwoof.telemetry.enabled", havingValue = "true")
public class OpenWoofTelemetryConfiguration {
    private static final Duration EXPORT_TIMEOUT = Duration.ofSeconds(5);

    @Bean
    RuntimeSettings openWoofRuntimeSettings(Environment environment) {
        return new RuntimeSettings(OpenWoofEnvironmentPostProcessor.ENDPOINT,
                OpenWoofEnvironmentPostProcessor.readKey(environment.getProperty("OPENWOOF_INGEST_KEY_FILE")),
                OpenWoofEnvironmentPostProcessor.identity(environment.getRequiredProperty("QB_SOURCE_COMMIT")));
    }

    @Bean
    TelemetryPrivacy telemetryPrivacy(RuntimeSettings settings) {
        return new TelemetryPrivacy(settings.key);
    }

    @Bean
    SpanExporter websiteSpanExporter(RuntimeSettings settings, TelemetryPrivacy privacy) {
        SpanExporter delegate = OtlpHttpSpanExporter.builder()
                .setEndpoint(settings.endpoint + "/v1/traces")
                .setHeaders(settings::headers)
                .setConnectTimeout(Duration.ofSeconds(2))
                .setTimeout(EXPORT_TIMEOUT)
                .setRetryPolicy(retryPolicy()).build();
        return sanitizeSpans(delegate, privacy);
    }

    @Bean
    LogRecordExporter websiteLogExporter(RuntimeSettings settings, TelemetryPrivacy privacy) {
        LogRecordExporter delegate = OtlpHttpLogRecordExporter.builder()
                .setEndpoint(settings.endpoint + "/v1/logs")
                .setHeaders(settings::headers)
                .setConnectTimeout(Duration.ofSeconds(2))
                .setTimeout(EXPORT_TIMEOUT)
                .setRetryPolicy(retryPolicy()).build();
        return sanitizeLogs(delegate, privacy);
    }

    @Bean
    OtlpConfig websiteMetricExportConfig(RuntimeSettings settings) {
        // Supply the exact single Authorization header privately. Boot's native
        // Micrometer registry uses this config; the key is never a property value.
        return new OtlpConfig() {
            @Override public String get(String key) { return null; }
            @Override public String url() { return settings.endpoint + "/v1/metrics"; }
            @Override public Map<String, String> headers() { return settings.headers(); }
            @Override public Map<String, String> resourceAttributes() { return settings.identity; }
            @Override public Duration step() { return Duration.ofSeconds(30); }
            @Override public Duration connectTimeout() { return Duration.ofSeconds(2); }
            @Override public Duration readTimeout() { return EXPORT_TIMEOUT; }
            @Override public int batchSize() { return 128; }
            @Override public TimeUnit baseTimeUnit() { return TimeUnit.SECONDS; }
            @Override public AggregationTemporality aggregationTemporality() { return AggregationTemporality.CUMULATIVE; }
        };
    }

    @Bean
    InitializingBean websiteLogbackBridge(OpenTelemetry openTelemetry) {
        // Replays the appender's bounded early-startup buffer with original event
        // times. Boot owns the SDK and its graceful lifecycle; no second provider.
        return () -> OpenTelemetryAppender.install(openTelemetry);
    }

    @Bean
    ObservationPredicate websiteHealthObservationFilter() {
        return (name, context) -> !(context instanceof ServerRequestObservationContext request
                && isHealthPath(request.getCarrier().getPath().value()));
    }

    @Bean
    MeterFilter websiteMeterLimit() {
        return MeterFilter.maximumAllowableMetrics(256);
    }

    @Bean
    MeterFilter websiteHttpRouteLimit() {
        return MeterFilter.maximumAllowableTags("http.server.requests", "uri", 32, MeterFilter.deny());
    }

    @Bean
    MeterFilter websiteMetricPrivacy() {
        return new MeterFilter() {
            @Override public Meter.Id map(Meter.Id id) {
                var safe = id.getTags().stream().filter(tag -> !java.util.Set.of(
                        "client.address", "client.ip", "url.full", "url.query", "http.url",
                        "user_agent.original", "db.statement", "db.query.text", "authorization",
                        "cookie", "email", "username").contains(tag.getKey().toLowerCase(java.util.Locale.ROOT))).toList();
                return id.replaceTags(safe);
            }
        };
    }

    static boolean isHealthPath(String path) {
        return path.equals("/actuator/health") || path.startsWith("/actuator/health/")
                || path.equals("/actuator/readiness") || path.equals("/actuator/liveness");
    }

    static RetryPolicy retryPolicy() {
        return RetryPolicy.builder().setMaxAttempts(3).setInitialBackoff(Duration.ofMillis(500))
                .setMaxBackoff(Duration.ofSeconds(2)).build();
    }

    static SpanExporter sanitizeSpans(SpanExporter delegate, TelemetryPrivacy privacy) {
        return new SpanExporter() {
            @Override public CompletableResultCode export(Collection<SpanData> spans) {
                try {
                    var safe = spans.stream().filter(privacy::shouldExport).map(privacy::sanitize).toList();
                    return safe.isEmpty() ? CompletableResultCode.ofSuccess() : delegate.export(safe);
                } catch (RuntimeException exception) {
                    return CompletableResultCode.ofFailure();
                }
            }
            @Override public CompletableResultCode flush() { return delegate.flush(); }
            @Override public CompletableResultCode shutdown() { return delegate.shutdown(); }
        };
    }

    static LogRecordExporter sanitizeLogs(LogRecordExporter delegate, TelemetryPrivacy privacy) {
        return new LogRecordExporter() {
            @Override public CompletableResultCode export(Collection<LogRecordData> records) {
                try {
                    return delegate.export(records.stream().map(privacy::sanitize).toList());
                } catch (RuntimeException exception) {
                    return CompletableResultCode.ofFailure();
                }
            }
            @Override public CompletableResultCode flush() { return delegate.flush(); }
            @Override public CompletableResultCode shutdown() { return delegate.shutdown(); }
        };
    }

    // Deliberately not a record: an automatically generated toString would leak
    // its credential if a diagnostic ever rendered this bean.
    static final class RuntimeSettings {
        final String endpoint;
        private final String key;
        final Map<String, String> identity;

        RuntimeSettings(String endpoint, String key, Map<String, String> identity) {
            this.endpoint = endpoint;
            this.key = key;
            this.identity = Map.copyOf(identity);
        }

        Map<String, String> headers() {
            return Map.of("Authorization", "Bearer " + key);
        }
    }
}
