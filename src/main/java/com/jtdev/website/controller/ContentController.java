package com.jtdev.website.controller;

import com.jtdev.website.service.ContentService;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/content")
@CrossOrigin(origins = {"http://localhost:8080", "http://javadevjt.tech", "https://javadevjt.tech"})
public class ContentController {

    private final ContentService contentService;

    public ContentController(ContentService contentService) {
        this.contentService = contentService;
    }

    @GetMapping("/directory/{path}")
    public Mono<Map<String, Object>> getDirectoryContents(@PathVariable String path) {
        try {
            List<String> contents = contentService.getDirectoryContents(path);
            Map<String, Object> result = new HashMap<>();
            result.put("path", path);
            result.put("contents", contents);
            return Mono.just(result);
        } catch (IOException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to read directory: " + e.getMessage());
            return Mono.just(error);
        }
    }

    @GetMapping("/file")
    public Mono<Map<String, Object>> getFileContent(@RequestParam String path) {
        try {
            String content = contentService.getMarkdownContent(path);
            Map<String, Object> result = new HashMap<>();
            result.put("path", path);
            result.put("content", content);
            return Mono.just(result);
        } catch (IOException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to read file: " + e.getMessage());
            return Mono.just(error);
        }
    }
}
