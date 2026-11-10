package com.jtdev.website.observability;

import io.micrometer.core.instrument.Clock;
import io.micrometer.registry.otlp.AggregationTemporality;
import io.micrometer.registry.otlp.OtlpConfig;
import io.micrometer.registry.otlp.OtlpMeterRegistry;

/** Adds a final bounded publish for cumulative metrics before registry shutdown. */
public final class WebsiteOtlpMeterRegistry extends OtlpMeterRegistry {
    private final OtlpConfig websiteConfig;

    public WebsiteOtlpMeterRegistry(OtlpConfig config, Clock clock) {
        super(config, clock);
        this.websiteConfig = config;
    }

    @Override
    public void close() {
        if (isClosed()) {
            return;
        }
        try {
            stop();
            if (isPublishing()) {
                waitForInProgressScheduledPublish();
            }
            // OtlpMeterRegistry's built-in close flushes DELTA data but only
            // rolls over CUMULATIVE meters. Publish cumulative values once while
            // the registry is still open so a final partial interval is retained.
            if (websiteConfig.enabled()
                    && websiteConfig.aggregationTemporality() == AggregationTemporality.CUMULATIVE) {
                publish();
            }
        } finally {
            super.close();
        }
    }
}
