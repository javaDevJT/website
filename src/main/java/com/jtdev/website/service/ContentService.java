package com.jtdev.website.service;

import com.vladsch.flexmark.html.HtmlRenderer;
import com.vladsch.flexmark.parser.Parser;
import com.vladsch.flexmark.util.ast.Node;
import com.vladsch.flexmark.util.data.MutableDataSet;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Service
public class ContentService {

    private final ResourceLoader resourceLoader;

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
}
