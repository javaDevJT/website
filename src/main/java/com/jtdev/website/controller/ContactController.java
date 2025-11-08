package com.jtdev.website.controller;

import com.jtdev.website.model.ContactMessage;
import com.jtdev.website.repository.ContactMessageRepository;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/contact")
@CrossOrigin(origins = {"http://localhost:8080", "http://javadevjt.tech", "https://javadevjt.tech"})
public class ContactController {

    private final ContactMessageRepository contactMessageRepository;

    public ContactController(ContactMessageRepository contactMessageRepository) {
        this.contactMessageRepository = contactMessageRepository;
    }

    @PostMapping
    public Mono<ContactMessage> submitContact(@RequestBody ContactMessage contactMessage) {
        contactMessage.setSubmittedDate(LocalDateTime.now());
        return Mono.just(contactMessageRepository.save(contactMessage));
    }
}
