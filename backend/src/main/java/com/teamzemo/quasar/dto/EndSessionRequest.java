package com.teamzemo.quasar.dto;

import java.util.Map;

public class EndSessionRequest {
    private Double overallScore;
    private Map<String, Object> starScores;
    private Double clarityScore;
    private String transcript;
    private Integer durationSeconds;

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
}
