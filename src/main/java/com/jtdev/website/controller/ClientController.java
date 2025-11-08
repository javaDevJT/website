package com.jtdev.website.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/client")
@CrossOrigin(origins = {"http://localhost:8080", "http://javadevjt.tech", "https://javadevjt.tech"})
public class ClientController {

    @GetMapping("/info")
    public Mono<Map<String, Object>> getClientInfo(ServerWebExchange exchange) {
        Map<String, Object> clientInfo = new HashMap<>();

        // Get client IP address
        String ipAddress = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
        if (ipAddress == null || ipAddress.isEmpty()) {
            ipAddress = exchange.getRequest().getRemoteAddress().getAddress().getHostAddress();
        }
        // Handle IPv6 localhost
        if (ipAddress != null && ipAddress.equals("0:0:0:0:0:0:0:1")) {
            ipAddress = "127.0.0.1";
        }

        clientInfo.put("ipAddress", ipAddress != null ? ipAddress : "unknown");
        clientInfo.put("userAgent", exchange.getRequest().getHeaders().getFirst("User-Agent"));
        clientInfo.put("hostname", "javadevjt.tech");
        clientInfo.put("username", "visitor");

        return Mono.just(clientInfo);
    }
}
