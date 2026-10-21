package com.jtdev.website.observability;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Scope;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Records bounded spans and real elapsed-time measurements for synchronous website operations.
 * Operation and collection values are closed enums so request or resource data cannot become
 * span names or metric labels.
 */
@Component
public final class WebsiteOperations {

    private static final String DURATION_METRIC = "website.operation.duration";
    private static final String CONTENT_COLLECTION_ATTRIBUTE = "content.collection";
    private static final String CONTENT_RESULT_ATTRIBUTE = "content.result";
    private static final String DATABASE_SYSTEM_ATTRIBUTE = "db.system.name";
    private static final String DATABASE_OPERATION_ATTRIBUTE = "db.operation.name";
    private static final String DATABASE_COLLECTION_ATTRIBUTE = "db.collection.name";
    private static final String DATABASE_SYSTEM = "h2";
    private static final String DATABASE_OPERATION = "SELECT";

    private static final WebsiteOperations NOOP = new WebsiteOperations(OpenTelemetry.noop(), null);

    private final Tracer tracer;
    private final MeterRegistry meterRegistry;

    @Autowired
    public WebsiteOperations(ObjectProvider<OpenTelemetry> openTelemetryProvider, MeterRegistry meterRegistry) {
        this(openTelemetryProvider.getIfAvailable(OpenTelemetry::noop), meterRegistry);
    }

    /**
     * Public for focused in-memory telemetry tests and manually constructed service fixtures.
     */
    public WebsiteOperations(OpenTelemetry openTelemetry, MeterRegistry meterRegistry) {
        this.tracer = Objects.requireNonNull(openTelemetry, "openTelemetry")
                .getTracer("com.jtdev.website.operations");
        this.meterRegistry = meterRegistry;
    }

    public static WebsiteOperations noop() {
        return NOOP;
    }

    public <T> T measure(Operation operation, ContentCollection collection, IoSupplier<T> work)
            throws IOException {
        try {
            return record(operation, collection, null, null, work::get);
        } catch (IOException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IOException("Unexpected checked exception during website operation", exception);
        }
    }

    public <T> T measureDatabase(
            Operation operation,
            ContentCollection collection,
            DatabaseCollection databaseCollection,
            Supplier<T> work) {
        try {
            return record(operation, collection, SpanKind.CLIENT, databaseCollection, work::get);
        } catch (RuntimeException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException("Unexpected checked exception during database operation", exception);
        }
    }

    private <T> T record(
            Operation operation,
            ContentCollection collection,
            SpanKind spanKind,
            DatabaseCollection databaseCollection,
            ThrowingSupplier<T> work) throws Exception {
        Span span = tracer.spanBuilder(operation.spanName())
                .setSpanKind(spanKind == null ? SpanKind.INTERNAL : spanKind)
                .startSpan();
        span.setAttribute(CONTENT_COLLECTION_ATTRIBUTE, collection.attributeValue());
        if (databaseCollection != null) {
            span.setAttribute(DATABASE_SYSTEM_ATTRIBUTE, DATABASE_SYSTEM);
            span.setAttribute(DATABASE_OPERATION_ATTRIBUTE, DATABASE_OPERATION);
            span.setAttribute(DATABASE_COLLECTION_ATTRIBUTE, databaseCollection.attributeValue());
        }

        Timer.Sample timerSample = meterRegistry == null ? null : Timer.start(meterRegistry);
        String result = "success";
        try (Scope ignored = span.makeCurrent()) {
            return work.get();
        } catch (Exception exception) {
            result = "error";
            span.recordException(exception);
            span.setStatus(StatusCode.ERROR);
            throw exception;
        } catch (Error error) {
            result = "error";
            span.recordException(error);
            span.setStatus(StatusCode.ERROR);
            throw error;
        } finally {
            span.setAttribute(CONTENT_RESULT_ATTRIBUTE, result);
            try {
                if (timerSample != null) {
                    timerSample.stop(Timer.builder(DURATION_METRIC)
                            .description("Elapsed time for a website operation")
                            .publishPercentileHistogram()
                            .tag("operation", operation.spanName())
                            .tag(CONTENT_COLLECTION_ATTRIBUTE, collection.attributeValue())
                            .tag("result", result)
                            .register(meterRegistry));
                }
            } finally {
                span.end();
            }
        }
    }

    public enum Operation {
        CONTENT_DIRECTORY_LIST("content.directory.list"),
        CONTENT_CATALOGUE_LIST("content.catalogue.list"),
        CONTENT_MARKDOWN_READ("content.markdown.read"),
        CONTENT_RESOURCE_READ("content.resource.read"),
        RESUME_PDF_EXTRACTION("content.resume.pdf.extract"),
        BLOG_DATABASE_LIST("blog.database.list"),
        BLOG_DATABASE_READ("blog.database.read");

        private final String spanName;

        Operation(String spanName) {
            this.spanName = spanName;
        }

        String spanName() {
            return spanName;
        }
    }

    public enum ContentCollection {
        BLOG("blog"),
        PORTFOLIO("portfolio"),
        RESUME("resume");

        private final String attributeValue;

        ContentCollection(String attributeValue) {
            this.attributeValue = attributeValue;
        }

        public String attributeValue() {
            return attributeValue;
        }

        public static ContentCollection forPublicDirectory(String directory) {
            return switch (directory) {
                case "blog" -> BLOG;
                case "portfolio" -> PORTFOLIO;
                default -> throw new IllegalArgumentException("Unsupported public content directory");
            };
        }
    }

    public enum DatabaseCollection {
        BLOG_POST("blog_post");

        private final String attributeValue;

        DatabaseCollection(String attributeValue) {
            this.attributeValue = attributeValue;
        }

        String attributeValue() {
            return attributeValue;
        }
    }

    @FunctionalInterface
    public interface IoSupplier<T> {
        T get() throws IOException;
    }

    @FunctionalInterface
    private interface ThrowingSupplier<T> {
        T get() throws Exception;
    }
}
