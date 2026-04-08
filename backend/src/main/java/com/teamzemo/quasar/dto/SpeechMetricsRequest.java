package com.teamzemo.quasar.dto;

import java.util.List;

public class SpeechMetricsRequest {
    private String transcript;
    private List<Object> fillerBuckets;
    private Integer totalFillers;
    private Double wordsPerMinute;

    public String getTranscript() { return transcript; }
    public void setTranscript(String transcript) { this.transcript = transcript; }
    public List<Object> getFillerBuckets() { return fillerBuckets; }
    public void setFillerBuckets(List<Object> fillerBuckets) { this.fillerBuckets = fillerBuckets; }
    public Integer getTotalFillers() { return totalFillers; }
    public void setTotalFillers(Integer totalFillers) { this.totalFillers = totalFillers; }
    public Double getWordsPerMinute() { return wordsPerMinute; }
    public void setWordsPerMinute(Double wordsPerMinute) { this.wordsPerMinute = wordsPerMinute; }
}
