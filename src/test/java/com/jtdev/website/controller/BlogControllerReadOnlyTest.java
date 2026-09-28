package com.jtdev.website.controller;

import com.jtdev.website.model.BlogPost;
import com.jtdev.website.repository.BlogPostRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.lang.reflect.Proxy;
import java.util.List;

class BlogControllerReadOnlyTest {

    @Test
    void keepsPublicReadsAvailableAndRejectsUnauthenticatedWrites() {
        BlogPostRepository repository = (BlogPostRepository) Proxy.newProxyInstance(
                BlogPostRepository.class.getClassLoader(),
                new Class<?>[]{BlogPostRepository.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("findAll") && method.getParameterCount() == 0) {
                        return List.<BlogPost>of();
                    }
                    throw new UnsupportedOperationException("Unexpected repository call: " + method.getName());
                });
        WebTestClient client = WebTestClient.bindToController(new BlogController(repository)).build();

        client.get().uri("/api/blog").exchange()
                .expectStatus().isOk()
                .expectBodyList(BlogPost.class).hasSize(0);
        client.post().uri("/api/blog").exchange().expectStatus().isEqualTo(405);
        client.put().uri("/api/blog/1").exchange().expectStatus().isEqualTo(405);
        client.delete().uri("/api/blog/1").exchange().expectStatus().isEqualTo(405);
    }
}
