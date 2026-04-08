package com.teamzemo.quasar.dto;

import java.util.List;
import java.util.Map;

public class EmotionMetricsRequest {
    private List<Map<String, Object>> metrics;

    public List<Map<String, Object>> getMetrics() { return metrics; }
    public void setMetrics(List<Map<String, Object>> metrics) { this.metrics = metrics; }
}
