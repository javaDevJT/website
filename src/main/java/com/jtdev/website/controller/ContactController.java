package com.jtdev.website.controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
@RequestMapping("/api/contact")
@CrossOrigin(origins = {"http://localhost:8080", "http://javadevjt.tech", "https://javadevjt.tech"})
public class ContactController {

    @GetMapping
    public Mono<Map<String, String>> getContactInformation() {
        Map<String, String> contactInfo = Map.of(
                "email", "joshterk@javadevjt.tech",
                "linkedin", "https://www.linkedin.com/in/joshuaterk/"
        );
        return Mono.just(contactInfo);
    }
}
