package com.jtdev.website;

import org.reactivestreams.Publisher;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.http.server.reactive.ServerHttpResponseDecorator;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class HealthSourceResponseFilter implements WebFilter {
    private final String sourceCommit;

    public HealthSourceResponseFilter(
            @org.springframework.beans.factory.annotation.Value("${QB_SOURCE_COMMIT:unknown}") String sourceCommit) {
        this.sourceCommit = SourceCommit.normalize(sourceCommit);
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String healthPath = exchange.getRequest().getPath().contextPath().value() + "/actuator/health";
        if (exchange.getRequest().getMethod() != HttpMethod.GET
                || !healthPath.equals(exchange.getRequest().getURI().getRawPath())) {
            return chain.filter(exchange);
        }

        ServerHttpResponse response = exchange.getResponse();
        ServerHttpResponseDecorator decorated = new ServerHttpResponseDecorator(response) {
            @Override
            public Mono<Void> writeWith(Publisher<? extends DataBuffer> body) {
                return DataBufferUtils.join(body)
                        .map(input -> {
                            String json;
                            try {
                                byte[] bytes = new byte[input.readableByteCount()];
                                input.read(bytes);
                                json = new String(bytes, StandardCharsets.UTF_8);
                            } finally {
                                DataBufferUtils.release(input);
                            }
                            String status = topLevelStatus(json);
                            return response.bufferFactory().wrap(minimalHealthJson(status));
                        })
                        .defaultIfEmpty(response.bufferFactory().wrap(minimalHealthJson("UNKNOWN")))
                        .flatMap(sanitized -> {
                            getHeaders().setContentType(MediaType.APPLICATION_JSON);
                            getHeaders().setContentLength(sanitized.readableByteCount());
                            return super.writeWith(Mono.just(sanitized));
                        });
            }

            @Override
            public Mono<Void> writeAndFlushWith(
                    Publisher<? extends Publisher<? extends DataBuffer>> body) {
                return writeWith(Flux.concat(body));
            }
        };
        return chain.filter(exchange.mutate().response(decorated).build());
    }

    private byte[] minimalHealthJson(String status) {
        String body = "{\"status\":\"" + status + "\",\"sourceCommit\":\"" + sourceCommit + "\"}";
        return body.getBytes(StandardCharsets.UTF_8);
    }

    private static String topLevelStatus(String json) {
        int depth = 0;
        for (int index = 0; index < json.length();) {
            char current = json.charAt(index);
            if (current == '"') {
                int end = stringEnd(json, index);
                if (end < 0) {
                    return "UNKNOWN";
                }
                if (depth == 1 && "status".equals(json.substring(index + 1, end))) {
                    int colon = skipWhitespace(json, end + 1);
                    if (colon < json.length() && json.charAt(colon) == ':') {
                        int valueStart = skipWhitespace(json, colon + 1);
                        int valueEnd = valueStart < json.length() && json.charAt(valueStart) == '"'
                                ? stringEnd(json, valueStart)
                                : -1;
                        if (valueEnd < 0) {
                            return "UNKNOWN";
                        }
                        String status = json.substring(valueStart + 1, valueEnd);
                        return status.matches("[A-Z_]+") ? status : "UNKNOWN";
                    }
                }
                index = end + 1;
                continue;
            }
            if (current == '{') {
                depth++;
            } else if (current == '}') {
                depth--;
            }
            index++;
        }
        return "UNKNOWN";
    }

    private static int stringEnd(String json, int start) {
        for (int index = start + 1; index < json.length(); index++) {
            char current = json.charAt(index);
            if (current == '\\') {
                index++;
            } else if (current == '"') {
                return index;
            }
        }
        return -1;
    }

    private static int skipWhitespace(String json, int start) {
        int index = start;
        while (index < json.length() && Character.isWhitespace(json.charAt(index))) {
            index++;
        }
        return index;
    }
}
