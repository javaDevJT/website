package com.jtdev.website.controller;

import com.jtdev.website.model.BlogPost;
import com.jtdev.website.repository.BlogPostRepository;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.List;

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
        return Flux.fromIterable(blogPostRepository.findAll());
    }

    @GetMapping("/{id}")
    public Mono<BlogPost> getPostById(@PathVariable Long id) {
        return Mono.justOrEmpty(blogPostRepository.findById(id));
    }

    @PostMapping
    public Mono<BlogPost> createPost(@RequestBody BlogPost blogPost) {
        blogPost.setCreatedDate(LocalDateTime.now());
        blogPost.setUpdatedDate(LocalDateTime.now());
        return Mono.just(blogPostRepository.save(blogPost));
    }

    @PutMapping("/{id}")
    public Mono<BlogPost> updatePost(@PathVariable Long id, @RequestBody BlogPost updatedPost) {
        return Mono.justOrEmpty(blogPostRepository.findById(id))
                .map(existing -> {
                    existing.setTitle(updatedPost.getTitle());
                    existing.setSummary(updatedPost.getSummary());
                    existing.setContent(updatedPost.getContent());
                    existing.setTags(updatedPost.getTags());
                    existing.setUpdatedDate(LocalDateTime.now());
                    return blogPostRepository.save(existing);
                });
    }

    @DeleteMapping("/{id}")
    public Mono<Void> deletePost(@PathVariable Long id) {
        blogPostRepository.deleteById(id);
        return Mono.empty();
    }
}
