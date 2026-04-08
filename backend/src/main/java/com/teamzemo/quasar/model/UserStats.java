package com.teamzemo.quasar.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "userstats")
public class UserStats {

    @Id
    private String id;
    @Indexed(unique = true)
    private String userId;
    private Integer xp = 0;
    private Integer level = 1;
    private Integer currentStreak = 0;
    private Integer longestStreak = 0;
    private String lastPracticeDate;
    private Integer totalSessions = 0;
    private List<String> domainsPlayed = new ArrayList<>();
    private List<String> personasUsed = new ArrayList<>();
    private Integer jdsParsed = 0;
    private Integer resumeComparesRun = 0;
    private List<Badge> badges = new ArrayList<>();
    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;

    public UserStats() {}
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public Integer getXp() { return xp; }
    public void setXp(Integer xp) { this.xp = xp; }
    public Integer getLevel() { return level; }
    public void setLevel(Integer level) { this.level = level; }
    public Integer getCurrentStreak() { return currentStreak; }
    public void setCurrentStreak(Integer currentStreak) { this.currentStreak = currentStreak; }
    public Integer getLongestStreak() { return longestStreak; }
    public void setLongestStreak(Integer longestStreak) { this.longestStreak = longestStreak; }
    public String getLastPracticeDate() { return lastPracticeDate; }
    public void setLastPracticeDate(String lastPracticeDate) { this.lastPracticeDate = lastPracticeDate; }
    public Integer getTotalSessions() { return totalSessions; }
    public void setTotalSessions(Integer totalSessions) { this.totalSessions = totalSessions; }
    public List<String> getDomainsPlayed() { return domainsPlayed; }
    public void setDomainsPlayed(List<String> domainsPlayed) { this.domainsPlayed = domainsPlayed; }
    public List<String> getPersonasUsed() { return personasUsed; }
    public void setPersonasUsed(List<String> personasUsed) { this.personasUsed = personasUsed; }
    public Integer getJdsParsed() { return jdsParsed; }
    public void setJdsParsed(Integer jdsParsed) { this.jdsParsed = jdsParsed; }
    public Integer getResumeComparesRun() { return resumeComparesRun; }
    public void setResumeComparesRun(Integer resumeComparesRun) { this.resumeComparesRun = resumeComparesRun; }
    public List<Badge> getBadges() { return badges; }
    public void setBadges(List<Badge> badges) { this.badges = badges; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
