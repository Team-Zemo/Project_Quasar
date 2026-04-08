package com.teamzemo.quasar.controller;

import com.teamzemo.quasar.dto.ApiResponse;
import com.teamzemo.quasar.model.Badge;
import com.teamzemo.quasar.model.UserStats;
import com.teamzemo.quasar.repository.UserStatsRepository;
import com.teamzemo.quasar.security.UserPrincipal;
import com.teamzemo.quasar.service.GamificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class GamificationController {

    private static final Logger log = LoggerFactory.getLogger(GamificationController.class);

    private final UserStatsRepository userStatsRepository;

    public GamificationController(UserStatsRepository userStatsRepository) {
        this.userStatsRepository = userStatsRepository;
    }

    /** GET /api/users/:userId/stats */
    @GetMapping("/users/{userId}/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUserStats(
            @PathVariable String userId,
            @AuthenticationPrincipal UserPrincipal principal) {
        try {
            if (!principal.getId().equals(userId)) {
                return ResponseEntity.status(403).<ApiResponse<Map<String, Object>>>body(ApiResponse.fail("Forbidden"));
            }

            UserStats stats = userStatsRepository.findByUserId(userId).orElse(null);

            int xp = 0, level = 1, currentStreak = 0, longestStreak = 0,
                totalSessions = 0, jdsParsed = 0, resumeComparesRun = 0;
            String lastPracticeDate = null;
            List<Badge> badges  = List.of();
            List<String> domainsPlayed = List.of();
            List<String> personasUsed  = List.of();

            if (stats != null) {
                xp                = stats.getXp()               != null ? stats.getXp()               : 0;
                level             = stats.getLevel()            != null ? stats.getLevel()            : 1;
                currentStreak     = stats.getCurrentStreak()    != null ? stats.getCurrentStreak()    : 0;
                longestStreak     = stats.getLongestStreak()    != null ? stats.getLongestStreak()    : 0;
                lastPracticeDate  = stats.getLastPracticeDate();
                totalSessions     = stats.getTotalSessions()    != null ? stats.getTotalSessions()    : 0;
                jdsParsed         = stats.getJdsParsed()        != null ? stats.getJdsParsed()        : 0;
                resumeComparesRun = stats.getResumeComparesRun()!= null ? stats.getResumeComparesRun(): 0;
                badges            = stats.getBadges()           != null ? stats.getBadges()           : List.of();
                domainsPlayed     = stats.getDomainsPlayed()    != null ? stats.getDomainsPlayed()    : List.of();
                personasUsed      = stats.getPersonasUsed()     != null ? stats.getPersonasUsed()     : List.of();
            }

            int[] LEVELS = GamificationService.LEVELS;
            Integer xpToNextLevel = (level < LEVELS.length) ? LEVELS[level] - xp : null;

            Map<String, Object> data = new LinkedHashMap<>();
            data.put("xp",               xp);
            data.put("level",            level);
            data.put("xpToNextLevel",    xpToNextLevel);
            data.put("currentStreak",    currentStreak);
            data.put("longestStreak",    longestStreak);
            data.put("lastPracticeDate", lastPracticeDate);
            data.put("totalSessions",    totalSessions);
            data.put("badges",           badges);
            data.put("domainsPlayed",    domainsPlayed);
            data.put("personasUsed",     personasUsed);
            data.put("jdsParsed",        jdsParsed);
            data.put("resumeComparesRun",resumeComparesRun);

            return ResponseEntity.ok(ApiResponse.ok("Stats retrieved", data));
        } catch (Exception e) {
            log.error("Get user stats error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to get stats"));
        }
    }

    /** GET /api/users/:userId/badges */
    @GetMapping("/users/{userId}/badges")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUserBadges(
            @PathVariable String userId,
            @AuthenticationPrincipal UserPrincipal principal) {
        try {
            if (!principal.getId().equals(userId)) {
                return ResponseEntity.status(403).<ApiResponse<Map<String, Object>>>body(ApiResponse.fail("Forbidden"));
            }

            UserStats stats = userStatsRepository.findByUserId(userId).orElse(null);
            List<Badge> earned = stats != null && stats.getBadges() != null ? stats.getBadges() : List.of();

            Set<String> earnedIds = earned.stream().map(Badge::getId).collect(Collectors.toSet());

            List<Map<String, Object>> catalogue =
                    GamificationService.ALL_BADGES.entrySet().stream().map(e -> {
                        String id   = e.getKey();
                        Map<String, String> meta = e.getValue();
                        Badge match  = earned.stream()
                                .filter(b -> id.equals(b.getId()))
                                .findFirst().orElse(null);
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("id",          id);
                        item.put("name",        meta.get("name"));
                        item.put("description", meta.get("description"));
                        item.put("icon",        meta.get("icon"));
                        item.put("unlocked",    earnedIds.contains(id));
                        item.put("unlockedAt",  match != null ? match.getUnlockedAt() : null);
                        return item;
                    }).collect(Collectors.toList());

            return ResponseEntity.ok(ApiResponse.ok("Badges retrieved", Map.of(
                    "earned",  earned.size(),
                    "total",   catalogue.size(),
                    "badges",  catalogue
            )));
        } catch (Exception e) {
            log.error("Get user badges error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to get badges"));
        }
    }
}
