package com.jtdev.website.model;

import java.time.LocalDate;
import java.util.List;

public class BlogMetadata {
    private String filename;
    private String title;
    private LocalDate published;
    private List<String> tags;
    private String excerpt;
    
    public BlogMetadata() {}
    
    public BlogMetadata(String filename, String title, LocalDate published, List<String> tags, String excerpt) {
        this.filename = filename;
        this.title = title;
        this.published = published;
        this.tags = tags;
        this.excerpt = excerpt;
    }
    
    // Getters and setters
    public String getFilename() {
        return filename;
    }
    
    public void setFilename(String filename) {
        this.filename = filename;
    }
    
    public String getTitle() {
        return title;
    }
    
    public void setTitle(String title) {
        this.title = title;
    }
    
    public LocalDate getPublished() {
        return published;
    }
    
    public void setPublished(LocalDate published) {
        this.published = published;
    }
    
    public List<String> getTags() {
        return tags;
    }
    
    public void setTags(List<String> tags) {
        this.tags = tags;
    }
    
    public String getExcerpt() {
        return excerpt;
    }
    
    public void setExcerpt(String excerpt) {
        this.excerpt = excerpt;
    }
}
