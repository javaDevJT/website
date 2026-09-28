package com.jtdev.website.controller;

import com.jtdev.website.model.BlogPost;
import com.jtdev.website.repository.BlogPostRepository;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@RestController
@RequestMapping("/api/blog")
@CrossOrigin(origins = {"http://localhost:8080", "http://javadevjt.tech", "https://javadevjt.tech"})
public class BlogController {

    private final BlogPostRepository blogPostRepository;

    public BlogController(BlogPostRepository blogPostRepository) {
        this.blogPostRepository = blogPostRepository;
    }

    @GetMapping
    public Flux<BlogPost> getAllPosts() {
        return Flux.defer(() -> Flux.fromIterable(blogPostRepository.findAll()))
                .subscribeOn(Schedulers.boundedElastic());
    }

    @GetMapping("/{id}")
    public Mono<BlogPost> getPostById(@PathVariable Long id) {
        return Mono.defer(() -> Mono.justOrEmpty(blogPostRepository.findById(id)))
                .subscribeOn(Schedulers.boundedElastic());
    }

}
