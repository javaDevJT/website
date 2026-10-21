package com.jtdev.website.controller;

import com.jtdev.website.model.BlogPost;
import com.jtdev.website.observability.WebsiteOperations;
import com.jtdev.website.observability.WebsiteOperations.ContentCollection;
import com.jtdev.website.observability.WebsiteOperations.DatabaseCollection;
import com.jtdev.website.observability.WebsiteOperations.Operation;
import com.jtdev.website.repository.BlogPostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@RestController
@RequestMapping("/api/blog")
@CrossOrigin(origins = {"http://localhost:8080", "http://javadevjt.tech", "https://javadevjt.tech"})
public class BlogController {

    private final BlogPostRepository blogPostRepository;
    private final WebsiteOperations websiteOperations;

    @Autowired
    public BlogController(BlogPostRepository blogPostRepository, WebsiteOperations websiteOperations) {
        this.blogPostRepository = blogPostRepository;
        this.websiteOperations = websiteOperations;
    }

    public BlogController(BlogPostRepository blogPostRepository) {
        this(blogPostRepository, WebsiteOperations.noop());
    }

    @GetMapping
    public Flux<BlogPost> getAllPosts() {
        return Flux.defer(() -> Flux.fromIterable(websiteOperations.measureDatabase(
                        Operation.BLOG_DATABASE_LIST,
                        ContentCollection.BLOG,
                        DatabaseCollection.BLOG_POST,
                        blogPostRepository::findAll)))
                .subscribeOn(Schedulers.boundedElastic());
    }

    @GetMapping("/{id}")
    public Mono<BlogPost> getPostById(@PathVariable Long id) {
        return Mono.defer(() -> Mono.justOrEmpty(websiteOperations.measureDatabase(
                        Operation.BLOG_DATABASE_READ,
                        ContentCollection.BLOG,
                        DatabaseCollection.BLOG_POST,
                        () -> blogPostRepository.findById(id))))
                .subscribeOn(Schedulers.boundedElastic());
    }

}
