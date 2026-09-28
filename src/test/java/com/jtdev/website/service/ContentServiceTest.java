package com.jtdev.website.service;

import com.jtdev.website.controller.ContentController;
import com.jtdev.website.model.BlogMetadata;
import com.jtdev.website.model.PortfolioMetadata;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.io.IOException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.jar.JarEntry;
import java.util.jar.JarOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ContentServiceTest {

    @Test
    void rejectsPathsOutsidePublicContentRoots() {
        ContentService service = new ContentService(new DefaultResourceLoader());

        assertTrue(new DefaultResourceLoader()
                .getResource("classpath:directories/../application.properties").exists());
        assertThrows(IllegalArgumentException.class, () -> service.getMarkdownContent("../application.properties"));
        assertThrows(IllegalArgumentException.class, () -> service.getMarkdownContent("blog/../../application.properties"));
        assertThrows(IllegalArgumentException.class, () -> service.getMarkdownContent("blog\\..\\application.properties"));
        assertThrows(IllegalArgumentException.class, () -> service.getDirectoryContents("../"));
    }

    @Test
    void rejectsInvalidPathsOverHttpWithoutReturningAResource() {
        ContentService service = new ContentService(new DefaultResourceLoader());
        WebTestClient client = WebTestClient.bindToController(new ContentController(service)).build();

        client.get()
                .uri(uriBuilder -> uriBuilder.path("/api/content/file")
                        .queryParam("path", "../application.properties")
                        .build())
                .exchange()
                .expectStatus().isBadRequest();

        client.get()
                .uri("/api/content/directory/not-public")
                .exchange()
                .expectStatus().isBadRequest();
    }

    @Test
    void doesNotExposeInternalPathsInContentReadErrors() {
        ContentService failingService = new ContentService(new DefaultResourceLoader()) {
            @Override
            public List<String> getDirectoryContents(String path) throws IOException {
                throw new IOException("/srv/private/deploy/directories/blog");
            }

            @Override
            public String getMarkdownContent(String path) throws IOException {
                throw new IOException("/srv/private/deploy/directories/blog/entry.md");
            }
        };
        WebTestClient client = WebTestClient.bindToController(new ContentController(failingService)).build();

        client.get().uri("/api/content/directory/blog").exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.error").isEqualTo("Failed to read directory.");

        client.get().uri(uriBuilder -> uriBuilder.path("/api/content/file")
                        .queryParam("path", "blog/entry.md")
                        .build())
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.error").isEqualTo("Failed to read public file.");
    }

    @Test
    void parsesExistingUndelimitedPortfolioMetadataAndFiltersByTechnology() throws IOException {
        ContentService service = new ContentService(new DefaultResourceLoader());
        List<PortfolioMetadata> projects = service.getPortfolioList();
        PortfolioMetadata routeList = projects.stream()
                .filter(project -> project.getFilename().equals("RouteListToTesla.md"))
                .findFirst()
                .orElseThrow();
        PortfolioMetadata dockerizedImapSync = projects.stream()
                .filter(project -> project.getFilename().equals("dockerized-imap-sync.md"))
                .findFirst()
                .orElseThrow();

        assertEquals("2025", routeList.getYear());
        assertTrue(routeList.getTechnologies().contains("Tesseract 5.5.1"));
        assertTrue(routeList.getExcerpt().startsWith("RouteListToTesla is a Spring Boot service"));
        assertTrue(service.filterPortfolioByTech("Tesseract").stream()
                .anyMatch(project -> project.getFilename().equals("RouteListToTesla.md")));

        assertEquals("2026", dockerizedImapSync.getYear());
        assertTrue(dockerizedImapSync.getTechnologies().contains("Docker"));
        assertTrue(dockerizedImapSync.getExcerpt().startsWith("dockerized-imap-sync is a standalone Docker container"));
        assertTrue(service.filterPortfolioByTech("docker").stream()
                .anyMatch(project -> project.getFilename().equals("dockerized-imap-sync.md")));
    }

    @Test
    void listsAndReadsMarkdownFromPackagedJarResources(@TempDir Path temporaryDirectory) throws Exception {
        Path jarPath = temporaryDirectory.resolve("content-fixtures.jar");
        try (JarOutputStream jar = new JarOutputStream(java.nio.file.Files.newOutputStream(jarPath))) {
            addJarEntry(jar, "directories/");
            addJarEntry(jar, "directories/blog/");
            addJarEntry(jar, "directories/portfolio/");
            addJarEntry(jar, "directories/blog/entry.md",
                    "---\ntitle: Jar Blog Entry\npublished: Sep 2026\n---\nA blog entry from a JAR.\n");
            addJarEntry(jar, "directories/blog/cover.png", "image fixture");
            addJarEntry(jar, "directories/blog/earlier.md",
                    "---\ntitle: Earlier Entry\npublished: 2025-01-01\n---\nAn earlier entry.\n");
            addJarEntry(jar, "directories/blog/beta.md", "---\ntitle: Beta Entry\n---\nNo date.\n");
            addJarEntry(jar, "directories/blog/alpha.md", "---\ntitle: Alpha Entry\n---\nNo date.\n");
            addJarEntry(jar, "directories/portfolio/project.md",
                    "---\ntitle: Jar Portfolio Project\n---\nA portfolio entry from a JAR.\n");
            addJarEntry(jar, "application.properties", "secret.marker=must-not-be-returned\n");
        }

        Path dependencyJarPath = temporaryDirectory.resolve("dependency-content.jar");
        try (JarOutputStream jar = new JarOutputStream(java.nio.file.Files.newOutputStream(dependencyJarPath))) {
            addJarEntry(jar, "directories/");
            addJarEntry(jar, "directories/blog/");
            addJarEntry(jar, "directories/blog/private.md", "Dependency content must not be exposed.\n");
            addJarEntry(jar, "directories/portfolio/");
            addJarEntry(jar, "directories/portfolio/hidden.md", "Hidden dependency project.\n");
        }

        URL[] classpath = {jarPath.toUri().toURL(), dependencyJarPath.toUri().toURL()};
        try (URLClassLoader classLoader = new URLClassLoader(classpath, null)) {
            ContentService service = new ContentService(new DefaultResourceLoader(classLoader));

            assertEquals(List.of("alpha.md", "beta.md", "cover.png", "earlier.md", "entry.md"),
                    service.getDirectoryContents("blog"));
            List<BlogMetadata> blogs = service.getBlogList();
            assertEquals(List.of("entry.md", "earlier.md", "alpha.md", "beta.md"),
                    blogs.stream().map(BlogMetadata::getFilename).toList());
            assertEquals(LocalDate.of(2026, 9, 1), blogs.get(0).getPublished());
            assertEquals(1, service.getPortfolioList().size());
            assertTrue(service.getMarkdownContent("blog/entry.md").contains("A blog entry from a JAR."));
            assertEquals("File not found: blog/private.md", service.getMarkdownContent("blog/private.md"));
        }
    }

    private static void addJarEntry(JarOutputStream jar, String name) throws IOException {
        addJarEntry(jar, name, "");
    }

    private static void addJarEntry(JarOutputStream jar, String name, String content) throws IOException {
        jar.putNextEntry(new JarEntry(name));
        if (!name.endsWith("/")) {
            jar.write(content.getBytes(StandardCharsets.UTF_8));
        }
        jar.closeEntry();
    }
}
