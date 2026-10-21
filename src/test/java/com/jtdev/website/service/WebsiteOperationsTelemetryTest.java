package com.jtdev.website.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.jtdev.website.controller.BlogController;
import com.jtdev.website.model.BlogMetadata;
import com.jtdev.website.model.BlogPost;
import com.jtdev.website.observability.WebsiteOperations;
import com.jtdev.website.observability.WebsiteOperations.ContentCollection;
import com.jtdev.website.observability.WebsiteOperations.Operation;
import com.jtdev.website.repository.BlogPostRepository;
import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.testing.exporter.InMemorySpanExporter;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.data.SpanData;
import io.opentelemetry.sdk.trace.export.SimpleSpanProcessor;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.DefaultResourceLoader;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WebsiteOperationsTelemetryTest {

    @Test
    void contentCatalogueAndResourceReadsHaveBoundedChildSpansAndRealTimers() throws Exception {
        try (TelemetryFixture fixture = new TelemetryFixture()) {
            ContentService service = new ContentService(new DefaultResourceLoader(), fixture.operations);
            service.getDirectoryContents("blog");

            Tracer requestTracer = fixture.openTelemetry.getTracer("website.operations.test");
            Span request = requestTracer.spanBuilder("fixture.request").startSpan();
            List<BlogMetadata> blogs;
            try (var ignored = request.makeCurrent()) {
                blogs = service.getBlogList();
            } finally {
                request.end();
            }
            service.getPortfolioList();
            service.getMarkdownContent("blog/" + blogs.getFirst().getFilename());
            service.getResumeText();
            service.getResumeText();

            List<SpanData> spans = fixture.exporter.getFinishedSpanItems();
            SpanData catalogue = spans.stream()
                    .filter(span -> span.getName().equals("content.catalogue.list"))
                    .filter(span -> "blog".equals(span.getAttributes().get(
                            AttributeKey.stringKey("content.collection"))))
                    .findFirst()
                    .orElseThrow();
            List<SpanData> resourceReads = spans.stream()
                    .filter(span -> span.getName().equals("content.resource.read"))
                    .toList();
            assertFalse(resourceReads.isEmpty(), "the catalogue must read its actual Markdown resources");
            assertEquals(request.getSpanContext().getSpanId(), catalogue.getParentSpanId());
            assertEquals("success", catalogue.getAttributes().get(AttributeKey.stringKey("content.result")));
            assertTrue(resourceReads.stream().anyMatch(
                    span -> span.getParentSpanId().equals(catalogue.getSpanId())));
            assertTrue(spans.stream().anyMatch(span -> span.getName().equals("content.markdown.read")));
            assertTrue(spans.stream().anyMatch(span -> span.getName().equals("content.resume.pdf.extract")));
            assertTrue(spans.stream().anyMatch(span -> span.getName().equals("content.catalogue.list")
                    && "portfolio".equals(span.getAttributes().get(AttributeKey.stringKey("content.collection")))));

            for (SpanData span : spans) {
                Map<AttributeKey<?>, Object> attributes = span.getAttributes().asMap();
                assertFalse(attributes.keySet().stream().anyMatch(key ->
                        key.getKey().matches("(?i).*(path|filename|url|query|user|request|id).*")));
            }

            Timer directoryTimer = timer(fixture.meters, "content.directory.list", "blog", "success");
            Timer catalogueTimer = timer(fixture.meters, "content.catalogue.list", "blog", "success");
            Timer portfolioCatalogueTimer = timer(
                    fixture.meters, "content.catalogue.list", "portfolio", "success");
            Timer markdownTimer = timer(fixture.meters, "content.markdown.read", "blog", "success");
            Timer pdfExtractionTimer = timer(fixture.meters, "content.resume.pdf.extract", "resume", "success");
            long blogResourceReads = resourceReads.stream()
                    .filter(span -> "blog".equals(span.getAttributes().get(AttributeKey.stringKey("content.collection"))))
                    .filter(span -> "success".equals(span.getAttributes().get(AttributeKey.stringKey("content.result"))))
                    .count();
            long portfolioResourceReads = resourceReads.stream()
                    .filter(span -> "portfolio".equals(span.getAttributes().get(AttributeKey.stringKey("content.collection"))))
                    .filter(span -> "success".equals(span.getAttributes().get(AttributeKey.stringKey("content.result"))))
                    .count();
            long resumeResourceReads = resourceReads.stream()
                    .filter(span -> "resume".equals(span.getAttributes().get(AttributeKey.stringKey("content.collection"))))
                    .filter(span -> "success".equals(span.getAttributes().get(AttributeKey.stringKey("content.result"))))
                    .count();
            Timer blogResourceTimer = timer(fixture.meters, "content.resource.read", "blog", "success");
            Timer portfolioResourceTimer = timer(fixture.meters, "content.resource.read", "portfolio", "success");
            Timer resumeResourceTimer = timer(fixture.meters, "content.resource.read", "resume", "success");
            assertEquals(Meter.Type.TIMER, directoryTimer.getId().getType());
            assertEquals(1, directoryTimer.count());
            assertEquals(1, catalogueTimer.count());
            assertEquals(1, portfolioCatalogueTimer.count());
            assertEquals(1, markdownTimer.count());
            assertEquals(1, pdfExtractionTimer.count(), "the second read uses the text cache");
            assertEquals(blogResourceReads, blogResourceTimer.count());
            assertEquals(portfolioResourceReads, portfolioResourceTimer.count());
            assertEquals(resumeResourceReads, resumeResourceTimer.count());
            assertTrue(catalogueTimer.totalTime(TimeUnit.NANOSECONDS) > 0);
        }
    }

    @Test
    void blogRepositoryReadsAreClientSpansInsideBoundedElasticWorkAndHaveActualTimers() throws Exception {
        try (TelemetryFixture fixture = new TelemetryFixture()) {
            AtomicReference<String> repositoryThread = new AtomicReference<>();
            BlogPostRepository repository = (BlogPostRepository) java.lang.reflect.Proxy.newProxyInstance(
                    BlogPostRepository.class.getClassLoader(),
                    new Class<?>[]{BlogPostRepository.class},
                    (proxy, method, args) -> {
                        repositoryThread.set(Thread.currentThread().getName());
                        return switch (method.getName()) {
                            case "findAll" -> List.<BlogPost>of();
                            case "findById" -> Optional.<BlogPost>empty();
                            default -> throw new UnsupportedOperationException(
                                    "Unexpected repository call: " + method.getName());
                        };
                    });
            BlogController controller = new BlogController(repository, fixture.operations);

            assertTrue(controller.getAllPosts().collectList().block(Duration.ofSeconds(5)).isEmpty());
            assertNull(controller.getPostById(123L).block(Duration.ofSeconds(5)));
            assertNotNull(repositoryThread.get());
            assertTrue(repositoryThread.get().startsWith("boundedElastic-"), repositoryThread.get());

            List<SpanData> databaseSpans = fixture.exporter.getFinishedSpanItems().stream()
                    .filter(span -> span.getName().startsWith("blog.database."))
                    .toList();
            assertEquals(2, databaseSpans.size());
            assertTrue(databaseSpans.stream().allMatch(span -> span.getKind() == SpanKind.CLIENT));
            for (SpanData span : databaseSpans) {
                assertEquals("h2", span.getAttributes().get(
                        io.opentelemetry.api.common.AttributeKey.stringKey("db.system.name")));
                assertEquals("SELECT", span.getAttributes().get(
                        io.opentelemetry.api.common.AttributeKey.stringKey("db.operation.name")));
                assertEquals("blog_post", span.getAttributes().get(
                        io.opentelemetry.api.common.AttributeKey.stringKey("db.collection.name")));
                assertEquals("blog", span.getAttributes().get(
                        io.opentelemetry.api.common.AttributeKey.stringKey("content.collection")));
            }

            assertEquals(1, timer(fixture.meters, "blog.database.list", "blog", "success").count());
            assertEquals(1, timer(fixture.meters, "blog.database.read", "blog", "success").count());
        }
    }

    @Test
    void failedOperationGetsErrorStatusAndActualErrorTimer() throws Exception {
        try (TelemetryFixture fixture = new TelemetryFixture()) {
            IOException failure = new IOException("fixture resource failure");

            IOException thrown = assertThrows(IOException.class, () -> fixture.operations.measure(
                    Operation.CONTENT_RESOURCE_READ,
                    ContentCollection.PORTFOLIO,
                    () -> {
                        throw failure;
                    }));

            assertEquals(failure, thrown);
            SpanData span = fixture.exporter.getFinishedSpanItems().getFirst();
            assertEquals("content.resource.read", span.getName());
            assertEquals(StatusCode.ERROR, span.getStatus().getStatusCode());
            assertEquals("portfolio", span.getAttributes().get(
                    io.opentelemetry.api.common.AttributeKey.stringKey("content.collection")));
            assertEquals("error", span.getAttributes().get(
                    io.opentelemetry.api.common.AttributeKey.stringKey("content.result")));
            assertTrue(span.getEvents().stream().anyMatch(event -> event.getName().equals("exception")));
            assertEquals(1, timer(fixture.meters, "content.resource.read", "portfolio", "error").count());
        }
    }

    @Test
    void metadataWarningKeepsMessageExceptionAndCollectionWhileNormalOperationsStaySilent() throws Exception {
        Logger logger = (Logger) LoggerFactory.getLogger(ContentService.class);
        Level originalLevel = logger.getLevel();
        boolean originalAdditivity = logger.isAdditive();
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.setLevel(Level.WARN);
        logger.setAdditive(false);
        logger.addAppender(appender);

        try {
            ContentService service = new ContentService(new DefaultResourceLoader());
            service.getDirectoryContents("blog");
            service.getMarkdownContent("blog/not-present.md");
            assertTrue(appender.list.isEmpty(), "successful and sentinel reads must not log completion messages");

            IOException failure = new IOException("invalid fixture metadata");
            ContentService.logMetadataFailure(ContentCollection.BLOG, "fixture.md", failure);

            assertEquals(1, appender.list.size());
            ILoggingEvent event = appender.list.getFirst();
            assertEquals("Error parsing blog metadata for fixture.md: invalid fixture metadata",
                    event.getFormattedMessage());
            assertNotNull(event.getThrowableProxy());
            assertEquals(IOException.class.getName(), event.getThrowableProxy().getClassName());
            assertTrue(event.getThrowableProxy().getStackTraceElementProxyArray().length > 0);
            assertTrue(event.getKeyValuePairs().stream().anyMatch(pair ->
                    pair.key.equals("content.collection") && pair.value.equals("blog")));
        } finally {
            logger.detachAppender(appender);
            logger.setLevel(originalLevel);
            logger.setAdditive(originalAdditivity);
            appender.stop();
        }
    }

    private static Timer timer(SimpleMeterRegistry meters, String operation, String collection, String result) {
        Timer timer = meters.find("website.operation.duration")
                .tag("operation", operation)
                .tag("content.collection", collection)
                .tag("result", result)
                .timer();
        assertNotNull(timer, "timer for " + operation);
        return timer;
    }

    private static final class TelemetryFixture implements AutoCloseable {
        private final InMemorySpanExporter exporter = InMemorySpanExporter.create();
        private final SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
                .addSpanProcessor(SimpleSpanProcessor.create(exporter))
                .build();
        private final OpenTelemetrySdk openTelemetry = OpenTelemetrySdk.builder()
                .setTracerProvider(tracerProvider)
                .build();
        private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
        private final WebsiteOperations operations = new WebsiteOperations(openTelemetry, meters);

        @Override
        public void close() {
            tracerProvider.close();
            meters.close();
        }
    }
}
