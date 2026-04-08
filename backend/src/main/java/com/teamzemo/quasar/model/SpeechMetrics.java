package com.teamzemo.quasar.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "speechmetrics")
public class SpeechMetrics {

    @Id
    private String id;
    @Indexed
    private String sessionId;
    private String transcript = "";
    private List<Object> fillerBuckets = new ArrayList<>();
    private Integer totalFillers = 0;
    private Double wordsPerMinute = 0.0;
    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;

    public SpeechMetrics() {}
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public String getTranscript() { return transcript; }
    public void setTranscript(String transcript) { this.transcript = transcript; }
    public List<Object> getFillerBuckets() { return fillerBuckets; }
    public void setFillerBuckets(List<Object> fillerBuckets) { this.fillerBuckets = fillerBuckets; }
    public Integer getTotalFillers() { return totalFillers; }
    public void setTotalFillers(Integer totalFillers) { this.totalFillers = totalFillers; }
    public Double getWordsPerMinute() { return wordsPerMinute; }
    public void setWordsPerMinute(Double wordsPerMinute) { this.wordsPerMinute = wordsPerMinute; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
