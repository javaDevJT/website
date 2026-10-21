package com.jtdev.website.observability;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.filter.Filter;
import ch.qos.logback.core.spi.FilterReply;

/** Filters only the OTLP bridge; original console logging is always retained. */
public final class TelemetryBridgeFilter extends Filter<ILoggingEvent> {
    private boolean enabled;

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    @Override
    public FilterReply decide(ILoggingEvent event) {
        String logger = event.getLoggerName();
        if (!enabled || logger.startsWith("io.opentelemetry.")
                || logger.startsWith("io.micrometer.registry.otlp.")) {
            return FilterReply.DENY;
        }
        return FilterReply.NEUTRAL;
    }
}
