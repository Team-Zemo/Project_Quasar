package com.teamzemo.quasar.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "personas")
public class Persona {

    @Id
    private String id;
    private String name;
    private String description;
    private String systemPrompt;
    private String interruptionStyle = "minimal";
    private Integer followUpAggression = 3;
    @CreatedDate
    private Instant createdAt;

    public Persona() {}
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSystemPrompt() { return systemPrompt; }
    public void setSystemPrompt(String systemPrompt) { this.systemPrompt = systemPrompt; }
    public String getInterruptionStyle() { return interruptionStyle; }
    public void setInterruptionStyle(String interruptionStyle) { this.interruptionStyle = interruptionStyle; }
    public Integer getFollowUpAggression() { return followUpAggression; }
    public void setFollowUpAggression(Integer followUpAggression) { this.followUpAggression = followUpAggression; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
