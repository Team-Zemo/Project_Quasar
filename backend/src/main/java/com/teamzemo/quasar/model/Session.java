package com.teamzemo.quasar.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Document(collection = "sessions")
public class Session {

    @Id
    private String id;
    @Indexed
    private String userId;
    private String domain;
    private String personaId;
    private String jdSessionId;
    private String status = "active";
    private Double overallScore;
    private Map<String, Object> starScores;
    private Double clarityScore;
    private String transcript = "";
    private Integer durationSeconds = 0;
    private Instant startedAt = Instant.now();
    private Instant endedAt;
    private List<Map<String, Object>> emotionMetrics = new ArrayList<>();
    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;

    public Session() {}
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }
    public String getPersonaId() { return personaId; }
    public void setPersonaId(String personaId) { this.personaId = personaId; }
    public String getJdSessionId() { return jdSessionId; }
    public void setJdSessionId(String jdSessionId) { this.jdSessionId = jdSessionId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Double getOverallScore() { return overallScore; }
    public void setOverallScore(Double overallScore) { this.overallScore = overallScore; }
    public Map<String, Object> getStarScores() { return starScores; }
    public void setStarScores(Map<String, Object> starScores) { this.starScores = starScores; }
    public Double getClarityScore() { return clarityScore; }
    public void setClarityScore(Double clarityScore) { this.clarityScore = clarityScore; }
    public String getTranscript() { return transcript; }
    public void setTranscript(String transcript) { this.transcript = transcript; }
    public Integer getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getEndedAt() { return endedAt; }
    public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }
    public List<Map<String, Object>> getEmotionMetrics() { return emotionMetrics; }
    public void setEmotionMetrics(List<Map<String, Object>> emotionMetrics) { this.emotionMetrics = emotionMetrics; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
