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
import reactor.core.scheduler.Schedulers;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.concurrent.Callable;
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
        return this.<Map<String, Object>>blocking(() -> {
            List<String> contents = contentService.getDirectoryContents(path);
            return Map.of("path", path, "contents", contents);
        }).onErrorMap(IllegalArgumentException.class,
                e -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid public content path"))
          .onErrorResume(IOException.class,
                e -> Mono.<Map<String, Object>>just(Map.of("error", "Failed to read directory.")));
    }

    @GetMapping("/file")
    public Mono<Map<String, Object>> getFileContent(@RequestParam String path) {
        return this.<Map<String, Object>>blocking(() -> {
            String content = contentService.getMarkdownContent(path);
            return Map.of("path", path, "content", content);
        }).onErrorMap(IllegalArgumentException.class,
                e -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid public content path"))
          .onErrorResume(IOException.class,
                e -> Mono.<Map<String, Object>>just(Map.of("error", "Failed to read public file.")));
    }

    @GetMapping("/blog/list")
    public Mono<List<BlogMetadata>> getBlogList() {
        return blocking(contentService::getBlogList)
                .onErrorResume(IOException.class, e -> Mono.just(List.of()));
    }

    @GetMapping("/blog/search")
    public Mono<List<BlogMetadata>> searchBlogs(@RequestParam(required = false) String term) {
        return blocking(() -> contentService.searchBlogs(term))
                .onErrorResume(IOException.class, e -> Mono.just(List.of()));
    }

    @GetMapping("/portfolio/list")
    public Mono<List<PortfolioMetadata>> getPortfolioList() {
        return blocking(contentService::getPortfolioList)
                .onErrorResume(IOException.class, e -> Mono.just(List.of()));
    }

    @GetMapping("/portfolio/filter")
    public Mono<List<PortfolioMetadata>> filterPortfolio(@RequestParam(required = false) String tech) {
        return blocking(() -> contentService.filterPortfolioByTech(tech))
                .onErrorResume(IOException.class, e -> Mono.just(List.of()));
    }

    @GetMapping("/resume")
    public Mono<Map<String, Object>> getResume() {
        return this.<Map<String, Object>>blocking(() -> {
            String resumeText = contentService.getResumeText();
            return Map.of("text", resumeText, "downloadUrl", "/api/content/resume/download");
        }).onErrorResume(e -> {
            return Mono.<Map<String, Object>>just(Map.of("error", "Failed to load resume."));
        });
    }

    @GetMapping("/resume/download")
    public Mono<ResponseEntity<Resource>> downloadResume() {
        return this.<ResponseEntity<Resource>>blocking(() -> {
            try {
                Resource pdf = contentService.getResumePdfResource();
                if (!pdf.exists()) {
                    return ResponseEntity.<Resource>notFound().build();
                }

                HttpHeaders headers = new HttpHeaders();
                headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=Joshua-Terk-Resume.pdf");

                return ResponseEntity.ok()
                        .headers(headers)
                        .contentType(MediaType.APPLICATION_PDF)
                        .body(pdf);
            } catch (Exception e) {
                return ResponseEntity.<Resource>status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }
        });
    }

    private <T> Mono<T> blocking(Callable<T> action) {
        return Mono.fromCallable(action).subscribeOn(Schedulers.boundedElastic());
    }
}
