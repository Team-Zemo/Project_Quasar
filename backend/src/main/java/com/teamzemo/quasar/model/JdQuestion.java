package com.teamzemo.quasar.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "jdquestions")
public class JdQuestion {

    @Id
    private String id;
    @Indexed
    private String jdSessionId;
    private String question;
    private String category;
    private Integer difficulty = 1;
    private String targetSkill;
    private Double weight = 0.5;
    private String lastAttemptedSession;
    private Double lastScore;
    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;

    public JdQuestion() {}
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getJdSessionId() { return jdSessionId; }
    public void setJdSessionId(String jdSessionId) { this.jdSessionId = jdSessionId; }
    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Integer getDifficulty() { return difficulty; }
    public void setDifficulty(Integer difficulty) { this.difficulty = difficulty; }
    public String getTargetSkill() { return targetSkill; }
    public void setTargetSkill(String targetSkill) { this.targetSkill = targetSkill; }
    public Double getWeight() { return weight; }
    public void setWeight(Double weight) { this.weight = weight; }
    public String getLastAttemptedSession() { return lastAttemptedSession; }
    public void setLastAttemptedSession(String lastAttemptedSession) { this.lastAttemptedSession = lastAttemptedSession; }
    public Double getLastScore() { return lastScore; }
    public void setLastScore(Double lastScore) { this.lastScore = lastScore; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
