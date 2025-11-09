package com.jtdev.website.service;

import com.jtdev.website.model.BlogMetadata;
import com.jtdev.website.model.PortfolioMetadata;
import com.vladsch.flexmark.html.HtmlRenderer;
import com.vladsch.flexmark.parser.Parser;
import com.vladsch.flexmark.util.ast.Node;
import com.vladsch.flexmark.util.data.MutableDataSet;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class ContentService {

    private final ResourceLoader resourceLoader;
    private String resumeTextCache;
    private final Object resumeLock = new Object();

    public ContentService(ResourceLoader resourceLoader) {
        this.resourceLoader = resourceLoader;
    }

    public List<String> getDirectoryContents(String path) throws IOException {
        List<String> contents = new ArrayList<>();

        // Use classpath resource to find the directory
        Resource resource = resourceLoader.getResource("classpath:directories/" + path);
        if (resource.exists()) {
            Path dirPath = Paths.get(resource.getURI());
            try (Stream<Path> paths = Files.walk(dirPath)) {
                paths.filter(Files::isRegularFile)
                     .map(p -> p.getFileName().toString())
                     .forEach(contents::add);
            }
        }

        return contents;
    }

    public String getMarkdownContent(String path) throws IOException {
        Resource resource = resourceLoader.getResource("classpath:directories/" + path);
        if (!resource.exists()) {
            return "File not found: " + path;
        }

        String markdown = new String(resource.getInputStream().readAllBytes());

        // Parse markdown and convert to ASCII-friendly format
        MutableDataSet options = new MutableDataSet();
        Parser parser = Parser.builder(options).build();
        HtmlRenderer renderer = HtmlRenderer.builder(options).build();

        Node document = parser.parse(markdown);
        String html = renderer.render(document);

        // Extract directory from path (e.g., "blog" from "blog/SAMPLE.md")
        String dir = path.contains("/") ? path.substring(0, path.lastIndexOf('/')) : "";
        
        // Convert HTML to ASCII art representation
        return convertHtmlToAscii(html, dir);
    }

    private String convertHtmlToAscii(String html, String dir) {
        // First pass: Convert headers with dynamic borders
        html = convertDynamicHeaders(html);
        
        // Convert HTML elements to ASCII formatting
        String text = html
            // Headers already converted above
            .replaceAll("<h3[^>]*>([^<]*)</h3>", "\n**$1**\n")
            .replaceAll("<h4[^>]*>([^<]*)</h4>", "\n**$1**\n")
            .replaceAll("<h5[^>]*>([^<]*)</h5>", "\n**$1**\n")
            .replaceAll("<h6[^>]*>([^<]*)</h6>", "\n**$1**\n")

            // Lists
            .replaceAll("<ul[^>]*>", "")
            .replaceAll("</ul>", "")
            .replaceAll("<li[^>]*>", "  • ")
            .replaceAll("</li>", "\n")

            // Paragraphs
            .replaceAll("<p[^>]*>", "")
            .replaceAll("</p>", "\n\n")

            // Line breaks
            .replaceAll("<br[^>]*>", "\n")

            // Links (simplified)
            .replaceAll("<a[^>]*href=\"([^\"]*)\"[^>]*>([^<]*)</a>", "$2 ($1)")

            // Code blocks
            .replaceAll("<pre[^>]*><code[^>]*>", "\n```\n")
            .replaceAll("</code></pre>", "\n```\n")

            // Inline code
            .replaceAll("<code[^>]*>([^<]*)</code>", "`$1`")

            // Bold and italic
            .replaceAll("<strong[^>]*>([^<]*)</strong>", "**$1**")
            .replaceAll("<em[^>]*>([^<]*)</em>", "*$1*")

            // Tables (simplified ASCII representation)
            .replaceAll("<table[^>]*>", "\n┌")
            .replaceAll("</table>", "┘\n")
            .replaceAll("<tr[^>]*>", "")
            .replaceAll("</tr>", "\n├")
            .replaceAll("<th[^>]*>", "─ ")
            .replaceAll("</th>", " ─")
            .replaceAll("<td[^>]*>", "│ ")
            .replaceAll("</td>", " │");

        // Handle images with ASCII art
        Pattern imgPattern = Pattern.compile("<img[^>]*src=\"([^\"]*)\"[^>]*>");
        Matcher matcher = imgPattern.matcher(text);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            String src = matcher.group(1);
            String ascii = generateAsciiArt(src, dir);
            matcher.appendReplacement(sb, Matcher.quoteReplacement(ascii));
        }
        matcher.appendTail(sb);
        text = sb.toString();

        // Handle images without src
        text = text.replaceAll("<img[^>]*>", "[Image]");
        text

            // Remove any remaining HTML tags
            .replaceAll("<[^>]+>", "")

            // Clean up entities and extra whitespace
            .replaceAll("&[^;]+;", "")
            .replaceAll("\\n\\s+", "\n")
            .replaceAll("\\s+\\n", "\n")
            .replaceAll("\\n{3,}", "\n\n")
            .trim();

        // The formatting is already handled in the regex replacements above
        return text.trim();
    }

    private String convertDynamicHeaders(String html) {
        // Convert H1 headers with dynamic borders
        Pattern h1Pattern = Pattern.compile("<h1[^>]*>(.*?)</h1>", Pattern.DOTALL);
        Matcher h1Matcher = h1Pattern.matcher(html);
        StringBuffer sb1 = new StringBuffer();
        while (h1Matcher.find()) {
            String headerText = sanitizeHeaderText(h1Matcher.group(1));
            int textLength = headerText.length();
            int totalWidth = textLength + 4; // 2 spaces on each side
            
            String topBorder = "\n╔" + "═".repeat(totalWidth) + "╗\n";
            String content = "║  " + headerText + "  ║\n";
            String bottomBorder = "╚" + "═".repeat(totalWidth) + "╝\n";
            
            String replacement = topBorder + content + bottomBorder;
            h1Matcher.appendReplacement(sb1, Matcher.quoteReplacement(replacement));
        }
        h1Matcher.appendTail(sb1);
        html = sb1.toString();
        
        // Convert H2 headers with dynamic borders
        Pattern h2Pattern = Pattern.compile("<h2[^>]*>(.*?)</h2>", Pattern.DOTALL);
        Matcher h2Matcher = h2Pattern.matcher(html);
        StringBuffer sb2 = new StringBuffer();
        while (h2Matcher.find()) {
            String headerText = sanitizeHeaderText(h2Matcher.group(1));
            int textLength = headerText.length();
            int totalWidth = textLength + 4; // 2 spaces on each side
            
            String topBorder = "\n┌" + "─".repeat(totalWidth) + "┐\n";
            String content = "│  " + headerText + "  │\n";
            String bottomBorder = "└" + "─".repeat(totalWidth) + "┘\n";
            
            String replacement = topBorder + content + bottomBorder;
            h2Matcher.appendReplacement(sb2, Matcher.quoteReplacement(replacement));
        }
        h2Matcher.appendTail(sb2);
        return sb2.toString();
    }

    private String sanitizeHeaderText(String rawHeader) {
        if (rawHeader == null) {
            return "";
        }
        String noTags = rawHeader.replaceAll("<[^>]+>", "").trim();
        return HtmlUtils.htmlUnescape(noTags);
    }

    private String generateAsciiArt(String src, String dir) {
        try {
            BufferedImage img;
            if (src.startsWith("http")) {
                img = ImageIO.read(new URL(src));
            } else {
                // Assume relative to classpath directories
                Resource res = resourceLoader.getResource("classpath:directories/" + (dir.isEmpty() ? "" : dir + "/") + src);
                img = ImageIO.read(res.getInputStream());
            }

            // Resize to small size for ASCII
            int width = 80;
            int height = (int) ((double) img.getHeight() / img.getWidth() * width * 0.5); // adjust for char aspect
            BufferedImage resized = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
            Graphics2D g2d = resized.createGraphics();
            g2d.drawImage(img, 0, 0, width, height, null);
            g2d.dispose();

            StringBuilder ascii = new StringBuilder();
            String chars = "@%#*+=-:. "; // from dark to light
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    int rgb = resized.getRGB(x, y);
                    int r = (rgb >> 16) & 0xff;
                    int g = (rgb >> 8) & 0xff;
                    int b = rgb & 0xff;
                    int gray = (r + g + b) / 3;
                    int index = gray * (chars.length() - 1) / 255;
                    ascii.append(chars.charAt(chars.length() - 1 - index));
                }
                ascii.append("\n");
            }
            return "\n" + ascii.toString() + "\n";
        } catch (Exception e) {
            return "[Image]";
        }
    }

    /**
     * Parse frontmatter from markdown content
     * Frontmatter is YAML between --- markers at the start of the file
     */
    private Map<String, String> parseFrontmatter(String markdown) {
        Map<String, String> frontmatter = new HashMap<>();
        
        if (!markdown.startsWith("---")) {
            return frontmatter;
        }
        
        int endIndex = markdown.indexOf("---", 3);
        if (endIndex == -1) {
            return frontmatter;
        }
        
        String yaml = markdown.substring(3, endIndex).trim();
        String[] lines = yaml.split("\n");
        
        for (String line : lines) {
            int colonIndex = line.indexOf(":");
            if (colonIndex > 0) {
                String key = line.substring(0, colonIndex).trim();
                String value = line.substring(colonIndex + 1).trim();
                frontmatter.put(key, value);
            }
        }
        
        return frontmatter;
    }

    /**
     * Extract excerpt from markdown (first paragraph or first 150 chars)
     */
    private String extractExcerpt(String markdown) {
        // Remove frontmatter
        String content = markdown;
        if (content.startsWith("---")) {
            int endIndex = content.indexOf("---", 3);
            if (endIndex != -1) {
                content = content.substring(endIndex + 3);
            }
        }
        
        // Remove markdown headers and formatting
        content = content.replaceAll("^#+\\s+.*$", "")
                        .replaceAll("\\*\\*([^*]+)\\*\\*", "$1")
                        .replaceAll("\\*([^*]+)\\*", "$1")
                        .replaceAll("`([^`]+)`", "$1")
                        .trim();
        
        // Get first paragraph or 150 chars
        int newlineIndex = content.indexOf("\n\n");
        if (newlineIndex > 0 && newlineIndex < 200) {
            content = content.substring(0, newlineIndex);
        } else if (content.length() > 150) {
            content = content.substring(0, 147) + "...";
        }
        
        return content.trim();
    }

    /**
     * Get list of blog posts with metadata
     */
    public List<BlogMetadata> getBlogList() throws IOException {
        List<BlogMetadata> blogs = new ArrayList<>();
        
        Resource resource = resourceLoader.getResource("classpath:directories/blog");
        if (!resource.exists()) {
            return blogs;
        }
        
        Path dirPath = Paths.get(resource.getURI());
        try (Stream<Path> paths = Files.walk(dirPath, 1)) {
            List<Path> mdFiles = paths
                .filter(Files::isRegularFile)
                .filter(p -> p.getFileName().toString().endsWith(".md"))
                .collect(Collectors.toList());
            
            for (Path file : mdFiles) {
                try {
                    String filename = file.getFileName().toString();
                    String markdown = Files.readString(file);
                    Map<String, String> frontmatter = parseFrontmatter(markdown);
                    
                    String title = frontmatter.getOrDefault("title", 
                        filename.replace(".md", "").replace("-", " "));
                    
                    LocalDate published = null;
                    String publishedStr = frontmatter.get("published");
                    if (publishedStr != null) {
                        try {
                            published = LocalDate.parse(publishedStr, 
                                DateTimeFormatter.ofPattern("MMM yyyy", Locale.ENGLISH));
                        } catch (DateTimeParseException e) {
                            try {
                                published = LocalDate.parse(publishedStr);
                            } catch (DateTimeParseException ignored) {}
                        }
                    }
                    
                    List<String> tags = new ArrayList<>();
                    String tagsStr = frontmatter.get("tags");
                    if (tagsStr != null) {
                        for (String tag : tagsStr.split(",|\\s+")) {
                            tag = tag.trim().replace("#", "");
                            if (!tag.isEmpty()) {
                                tags.add(tag);
                            }
                        }
                    }
                    
                    String excerpt = extractExcerpt(markdown);
                    
                    blogs.add(new BlogMetadata(filename, title, published, tags, excerpt));
                } catch (Exception e) {
                    System.err.println("Error parsing blog metadata for " + file + ": " + e.getMessage());
                }
            }
        }
        
        // Sort by published date (newest first)
        blogs.sort((a, b) -> {
            if (a.getPublished() == null) return 1;
            if (b.getPublished() == null) return -1;
            return b.getPublished().compareTo(a.getPublished());
        });
        
        return blogs;
    }

    /**
     * Get list of portfolio projects with metadata
     */
    public List<PortfolioMetadata> getPortfolioList() throws IOException {
        List<PortfolioMetadata> projects = new ArrayList<>();
        
        Resource resource = resourceLoader.getResource("classpath:directories/portfolio");
        if (!resource.exists()) {
            return projects;
        }
        
        Path dirPath = Paths.get(resource.getURI());
        try (Stream<Path> paths = Files.walk(dirPath, 1)) {
            List<Path> mdFiles = paths
                .filter(Files::isRegularFile)
                .filter(p -> p.getFileName().toString().endsWith(".md"))
                .collect(Collectors.toList());
            
            for (Path file : mdFiles) {
                try {
                    String filename = file.getFileName().toString();
                    String markdown = Files.readString(file);
                    Map<String, String> frontmatter = parseFrontmatter(markdown);
                    
                    String title = frontmatter.getOrDefault("title", 
                        filename.replace(".md", "").replace("-", " "));
                    
                    List<String> technologies = new ArrayList<>();
                    String techStr = frontmatter.get("technologies");
                    if (techStr != null) {
                        for (String tech : techStr.split(",")) {
                            tech = tech.trim();
                            if (!tech.isEmpty()) {
                                technologies.add(tech);
                            }
                        }
                    }
                    
                    String company = frontmatter.getOrDefault("company", "");
                    String year = frontmatter.getOrDefault("year", "");
                    String excerpt = extractExcerpt(markdown);
                    
                    projects.add(new PortfolioMetadata(filename, title, 
                        technologies, company, year, excerpt));
                } catch (Exception e) {
                    System.err.println("Error parsing portfolio metadata for " + file + ": " + e.getMessage());
                }
            }
        }
        
        return projects;
    }

    public String getResumeText() throws IOException {
        if (resumeTextCache != null) {
            return resumeTextCache;
        }

        synchronized (resumeLock) {
            if (resumeTextCache == null) {
                resumeTextCache = loadResumeTextFromPdf();
            }
        }

        return resumeTextCache;
    }

    public Resource getResumePdfResource() {
        Resource resource = resourceLoader.getResource("classpath:ResumeATSOptimizedLoud.pdf");
        if (!resource.exists()) {
            throw new IllegalStateException("Resume PDF not found on classpath");
        }
        return resource;
    }

    private String loadResumeTextFromPdf() throws IOException {
        Resource resource = resourceLoader.getResource("classpath:ResumeATSOptimizedLoud.pdf");
        if (!resource.exists()) {
            throw new IOException("Resume PDF not found");
        }

        byte[] pdfBytes;
        try (InputStream inputStream = resource.getInputStream()) {
            pdfBytes = inputStream.readAllBytes();
        }

        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setLineSeparator("\n");
            stripper.setSortByPosition(true);
            String rawText = stripper.getText(document);
            return formatResumeText(rawText);
        }
    }

    private String formatResumeText(String rawText) {
        if (rawText == null || rawText.isBlank()) {
            return "Resume text unavailable. Run 'resume --download' to open the PDF.";
        }

        String normalized = rawText
            .replace("\r\n", "\n")
            .replace("\r", "\n")
            .replaceAll("[ \t]+\n", "\n")
            .replaceAll("\n{3,}", "\n\n")
            .strip();

        String[] paragraphs = normalized.split("\n\n");
        StringBuilder builder = new StringBuilder();
        builder.append("╔════════════════════════════════════════════════════════════════════════════════════════════╗\n");
        for (String paragraph : paragraphs) {
            for (String line : wrapParagraph(paragraph)) {
                builder.append("║ ").append(padLine(line)).append(" ║\n");
            }
            builder.append("║ ").append(" ".repeat(90)).append(" ║\n");
        }
        builder.append("╚════════════════════════════════════════════════════════════════════════════════════════════╝");
        return builder.toString().replaceAll("\n{2,}╚", "\n╚");
    }

    private List<String> wrapParagraph(String paragraph) {
        List<String> lines = new ArrayList<>();
        String[] rawLines = paragraph.split("\n");
        for (String rawLine : rawLines) {
            String line = rawLine.trim();
            if (line.isEmpty()) {
                lines.add("");
                continue;
            }

            while (line.length() > 90) {
                int breakIndex = line.lastIndexOf(' ', 90);
                if (breakIndex <= 0) {
                    breakIndex = 90;
                }
                lines.add(line.substring(0, breakIndex));
                line = line.substring(breakIndex).trim();
            }
            lines.add(line);
        }
        return lines;
    }

    private String padLine(String line) {
        if (line.length() >= 90) {
            return line.substring(0, 90);
        }
        return line + " ".repeat(90 - line.length());
    }

    /**
     * Search blog posts by term (title, tags, content)
     */
    public List<BlogMetadata> searchBlogs(String searchTerm) throws IOException {
        if (searchTerm == null || searchTerm.trim().isEmpty()) {
            return getBlogList();
        }
        
        String term = searchTerm.toLowerCase();
        return getBlogList().stream()
            .filter(blog -> 
                blog.getTitle().toLowerCase().contains(term) ||
                blog.getExcerpt().toLowerCase().contains(term) ||
                blog.getTags().stream().anyMatch(tag -> tag.toLowerCase().contains(term))
            )
            .collect(Collectors.toList());
    }

    /**
     * Filter portfolio projects by technology
     */
    public List<PortfolioMetadata> filterPortfolioByTech(String technology) throws IOException {
        if (technology == null || technology.trim().isEmpty()) {
            return getPortfolioList();
        }
        
        String tech = technology.toLowerCase();
        return getPortfolioList().stream()
            .filter(project -> 
                project.getTechnologies().stream()
                    .anyMatch(t -> t.toLowerCase().contains(tech))
            )
            .collect(Collectors.toList());
    }
}
