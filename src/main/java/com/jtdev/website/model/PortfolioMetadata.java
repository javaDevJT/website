package com.jtdev.website.model;

import java.util.List;

public class PortfolioMetadata {
    private String filename;
    private String title;
    private List<String> technologies;
    private String company;
    private String year;
    private String excerpt;
    
    public PortfolioMetadata() {}
    
    public PortfolioMetadata(String filename, String title, List<String> technologies, 
                            String company, String year, String excerpt) {
        this.filename = filename;
        this.title = title;
        this.technologies = technologies;
        this.company = company;
        this.year = year;
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
    
    public List<String> getTechnologies() {
        return technologies;
    }
    
    public void setTechnologies(List<String> technologies) {
        this.technologies = technologies;
    }
    
    public String getCompany() {
        return company;
    }
    
    public void setCompany(String company) {
        this.company = company;
    }
    
    public String getYear() {
        return year;
    }
    
    public void setYear(String year) {
        this.year = year;
    }
    
    public String getExcerpt() {
        return excerpt;
    }
    
    public void setExcerpt(String excerpt) {
        this.excerpt = excerpt;
    }
}
