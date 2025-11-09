package com.jtdev.website.controller;

import com.jtdev.website.model.BlogMetadata;
import com.jtdev.website.model.PortfolioMetadata;
import com.jtdev.website.service.ContentService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

    @GetMapping("/blog/list")
    public Mono<List<BlogMetadata>> getBlogList() {
        try {
            return Mono.just(contentService.getBlogList());
        } catch (IOException e) {
            return Mono.just(List.of());
        }
    }

    @GetMapping("/blog/search")
    public Mono<List<BlogMetadata>> searchBlogs(@RequestParam(required = false) String term) {
        try {
            return Mono.just(contentService.searchBlogs(term));
        } catch (IOException e) {
            return Mono.just(List.of());
        }
    }

    @GetMapping("/portfolio/list")
    public Mono<List<PortfolioMetadata>> getPortfolioList() {
        try {
            return Mono.just(contentService.getPortfolioList());
        } catch (IOException e) {
            return Mono.just(List.of());
        }
    }

    @GetMapping("/portfolio/filter")
    public Mono<List<PortfolioMetadata>> filterPortfolio(@RequestParam(required = false) String tech) {
        try {
            return Mono.just(contentService.filterPortfolioByTech(tech));
        } catch (IOException e) {
            return Mono.just(List.of());
        }
    }

    @GetMapping("/resume")
    public Mono<Map<String, Object>> getResume() {
        return Mono.fromCallable(() -> {
            String resumeText = contentService.getResumeText();
            Map<String, Object> result = new HashMap<>();
            result.put("text", resumeText);
            result.put("downloadUrl", "/api/content/resume/download");
            return result;
        }).onErrorResume(e -> {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to load resume: " + e.getMessage());
            return Mono.just(error);
        });
    }

    @GetMapping("/resume/download")
    public Mono<ResponseEntity<Resource>> downloadResume() {
        return Mono.fromCallable(() -> {
            try {
                Resource pdf = contentService.getResumePdfResource();
                if (!pdf.exists()) {
                    return ResponseEntity.notFound().build();
                }

                HttpHeaders headers = new HttpHeaders();
                headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=Joshua-Terk-Resume.pdf");

                return ResponseEntity.ok()
                        .headers(headers)
                        .contentType(MediaType.APPLICATION_PDF)
                        .body(pdf);
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }
        });
    }
}
