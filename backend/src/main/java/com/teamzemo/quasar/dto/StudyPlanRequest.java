package com.teamzemo.quasar.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public class StudyPlanRequest {
    @NotBlank
    private String skillToLearn;
    @NotEmpty
    private List<String> techStack;
    private String currentLevel;
    private Integer dailyHours;
    @Min(1) @Max(52)
    private Integer weeks = 4;
    private String goals;

    public String getSkillToLearn() { return skillToLearn; }
    public void setSkillToLearn(String skillToLearn) { this.skillToLearn = skillToLearn; }
    public List<String> getTechStack() { return techStack; }
    public void setTechStack(List<String> techStack) { this.techStack = techStack; }
    public String getCurrentLevel() { return currentLevel; }
    public void setCurrentLevel(String currentLevel) { this.currentLevel = currentLevel; }
    public Integer getDailyHours() { return dailyHours; }
    public void setDailyHours(Integer dailyHours) { this.dailyHours = dailyHours; }
    public Integer getWeeks() { return weeks; }
    public void setWeeks(Integer weeks) { this.weeks = weeks; }
    public String getGoals() { return goals; }
    public void setGoals(String goals) { this.goals = goals; }
}
