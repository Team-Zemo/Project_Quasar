package com.teamzemo.quasar.dto;

import java.util.Map;

public class UpdateSkillVectorRequest {
    private Map<String, Object> starScores;
    private Map<String, Object> categoryScores;

    public Map<String, Object> getStarScores() { return starScores; }
    public void setStarScores(Map<String, Object> starScores) { this.starScores = starScores; }
    public Map<String, Object> getCategoryScores() { return categoryScores; }
    public void setCategoryScores(Map<String, Object> categoryScores) { this.categoryScores = categoryScores; }
}
