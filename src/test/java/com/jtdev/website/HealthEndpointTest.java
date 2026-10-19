package com.jtdev.website;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "QB_SOURCE_COMMIT=0123456789abcdef0123456789abcdef01234567")
class HealthEndpointTest {

    @LocalServerPort
    private int port;

    @Test
    void healthEndpointReturnsJson() throws Exception {
        try (HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build()) {
            HttpRequest request = HttpRequest.newBuilder(
                    URI.create("http://127.0.0.1:" + port + "/actuator/health"))
                    .timeout(Duration.ofSeconds(5))
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            assertEquals(200, response.statusCode());
            assertTrue(response.headers().firstValue("content-type").orElse("").startsWith("application/json"));
            assertTrue(response.body().contains("\"status\":\"UP\""), response.body());
            assertTrue(response.body().contains("\"sourceCommit\":\"0123456789abcdef0123456789abcdef01234567\""), response.body());
            assertFalse(response.body().contains("components"), response.body());
        }
    }
}
