package com.teamzemo.quasar.service;

import com.teamzemo.quasar.model.*;
import com.teamzemo.quasar.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

/**
 * Full port of gamificationService.js.
 * All pure logic is rewritten as Java static/instance methods.
 * processSession / onJDParsed / onResumeCompare are the side-effectful entry points.
 * Errors are swallowed so gamification never blocks the main response.
 */
@Service
public class GamificationService {

    private static final Logger log = LoggerFactory.getLogger(GamificationService.class);

    // Level thresholds (index = level-1, value = XP needed to reach that level)
    public static final int[] LEVELS = {0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000};

    // Full badge catalogue (matches JS ALL_BADGES)
    public static final Map<String, Map<String, String>> ALL_BADGES;
    static {
        Map<String, Map<String, String>> b = new LinkedHashMap<>();
        b.put("first_session",     badge("First Step",       "Completed your first interview session",              "🎯"));
        b.put("ten_sessions",      badge("Consistent",       "Completed 10 interview sessions",                    "📈"));
        b.put("fifty_sessions",    badge("Dedicated",        "Completed 50 interview sessions",                    "💪"));
        b.put("century",           badge("Centurion",         "Completed 100 interview sessions",                   "🏆"));
        b.put("first_pass",        badge("Passmark",          "Scored ≥ 6.5 for the first time",                   "✅"));
        b.put("high_achiever",     badge("High Achiever",     "Scored ≥ 8.0 in a session",                         "⭐"));
        b.put("perfect_ten",       badge("Perfect Ten",       "Scored ≥ 9.5 in a session",                         "💯"));
        b.put("comeback_kid",      badge("Comeback Kid",      "Scored ≥ 7.0 right after scoring below 5.0",        "↩️"));
        b.put("streak_3",          badge("On Fire",           "Maintained a 3-day practice streak",                "🔥"));
        b.put("streak_7",          badge("Week Warrior",      "Maintained a 7-day practice streak",                "⚡"));
        b.put("streak_14",         badge("Fortnight",         "Maintained a 14-day practice streak",               "🌟"));
        b.put("streak_30",         badge("Unstoppable",       "Maintained a 30-day practice streak",               "🚀"));
        b.put("domain_explorer",   badge("Domain Explorer",   "Practiced in 3 different domains",                   "🗺️"));
        b.put("polymath",          badge("Polymath",          "Practiced in 5 different domains",                   "🧠"));
        b.put("persona_collector", badge("Face the Panel",    "Completed sessions with all 4 personas",             "🎭"));
        b.put("no_fillers",        badge("Clean Speaker",     "Completed a session with fewer than 3 filler words", "🗣️"));
        b.put("speed_demon",       badge("Speed Demon",       "Spoke at over 150 words per minute",                 "💨"));
        b.put("slow_and_steady",   badge("Measured",          "Spoke at 120–150 words per minute",                  "⏱️"));
        b.put("level_5",           badge("Rising Star",       "Reached Level 5",                                    "🌠"));
        b.put("level_10",          badge("Interview Master",  "Reached Level 10",                                   "👑"));
        b.put("xp_500",            badge("XP Farmer",         "Earned 500 total XP",                                "💰"));
        b.put("night_owl",         badge("Night Owl",         "Completed a session between 22:00–04:00 UTC",        "🦉"));
        b.put("early_bird",        badge("Early Bird",        "Completed a session between 05:00–07:00 UTC",        "🐦"));
        b.put("resume_checker",    badge("Resume Analyst",    "Used the Resume vs JD comparison feature",           "📄"));
        b.put("jd_parser",         badge("JD Whisperer",      "Parsed 3 or more job descriptions",                  "📋"));
        ALL_BADGES = Collections.unmodifiableMap(b);
    }

    private static final List<String> ALL_PERSONAS = List.of(
            "faang_engineer", "startup_founder", "hr_manager", "hostile_panel");

    private final UserStatsRepository    userStatsRepository;
    private final SpeechMetricsRepository speechMetricsRepository;
    private final SessionRepository       sessionRepository;

    public GamificationService(UserStatsRepository userStatsRepository,
                                SpeechMetricsRepository speechMetricsRepository,
                                SessionRepository sessionRepository) {
        this.userStatsRepository    = userStatsRepository;
        this.speechMetricsRepository = speechMetricsRepository;
        this.sessionRepository      = sessionRepository;
    }

    // ── Main entry ────────────────────────────────────────────────────

    public Map<String, Object> processSession(String userId, Map<String, Object> sessionData) {
        try {
            if (userId == null) return null;

            UserStats stats = userStatsRepository.findByUserId(userId).orElse(null);
            if (stats == null) {
                stats = new UserStats();
                stats.setUserId(userId);
                stats = userStatsRepository.save(stats);
            }

            // Speech metrics for badge checks
            String sessionId = (String) sessionData.get("sessionId");
            SpeechMetrics speech = sessionId != null
                    ? speechMetricsRepository.findBySessionId(sessionId).orElse(null) : null;

            // Previous session score for comeback_kid
            Double prevScore = getPreviousSessionScore(userId, sessionId);

            // 1. Streak
            Map<String, Object> streakResult = computeStreak(stats);
            int newStreak = (int) streakResult.get("currentStreak");

            // 2. XP
            Map<String, Object> xpResult = computeXP(sessionData, newStreak);
            int xpEarned = (int) xpResult.get("total");
            int newXp    = (stats.getXp() != null ? stats.getXp() : 0) + xpEarned;
            int oldLevel = stats.getLevel() != null ? stats.getLevel() : 1;
            int newLevel = computeLevel(newXp);
            boolean levelUp = newLevel > oldLevel;

            // 3. Update domain/persona arrays
            List<String> domainsPlayed = new ArrayList<>(stats.getDomainsPlayed() != null
                    ? stats.getDomainsPlayed() : List.of());
            String domain = (String) sessionData.get("domain");
            if (domain != null && !domainsPlayed.contains(domain)) domainsPlayed.add(domain);

            List<String> personasUsed = new ArrayList<>(stats.getPersonasUsed() != null
                    ? stats.getPersonasUsed() : List.of());
            String personaId = (String) sessionData.get("personaId");
            if (personaId != null && !personasUsed.contains(personaId)) personasUsed.add(personaId);

            int totalSessions = (stats.getTotalSessions() != null ? stats.getTotalSessions() : 0) + 1;

            // 4. Badge checks
            Map<String, Object> snap = new HashMap<>();
            snap.put("badges",        stats.getBadges() != null ? stats.getBadges() : List.of());
            snap.put("xp",            newXp);
            snap.put("currentStreak", newStreak);
            snap.put("domainsPlayed", domainsPlayed);
            snap.put("personasUsed",  personasUsed);
            snap.put("jdsParsed",     stats.getJdsParsed() != null ? stats.getJdsParsed() : 0);
            snap.put("totalSessions", totalSessions);

            List<Badge> newBadges = checkBadges(snap, sessionData, speech, newLevel, prevScore);

            // 5. Persist
            stats.setXp(newXp);
            stats.setLevel(newLevel);
            stats.setCurrentStreak(newStreak);
            stats.setLongestStreak((int) streakResult.get("longestStreak"));
            stats.setLastPracticeDate((String) streakResult.get("lastPracticeDate"));
            stats.setTotalSessions(totalSessions);
            stats.setDomainsPlayed(domainsPlayed);
            stats.setPersonasUsed(personasUsed);
            if (!newBadges.isEmpty()) {
                List<Badge> allBadges = new ArrayList<>(
                        stats.getBadges() != null ? stats.getBadges() : List.of());
                allBadges.addAll(newBadges);
                stats.setBadges(allBadges);
            }
            userStatsRepository.save(stats);

            log.info("Gamification processed userId={} xpEarned={} newLevel={} levelUp={} badges={}",
                    userId, xpEarned, newLevel, levelUp,
                    newBadges.stream().map(Badge::getId).toList());

            // Return summary
            Map<String, Object> result = new HashMap<>();
            result.put("xpEarned",      xpEarned);
            result.put("xpBreakdown",   xpResult.get("breakdown"));
            result.put("totalXp",       newXp);
            result.put("level",         newLevel);
            result.put("levelUp",       levelUp);
            result.put("currentStreak", newStreak);
            result.put("longestStreak", streakResult.get("longestStreak"));
            result.put("newBadges",     newBadges.stream()
                    .map(b -> Map.of("id", b.getId(), "name", b.getName(), "icon", b.getIcon()))
                    .toList());
            return result;

        } catch (Exception e) {
            log.error("Gamification processSession error userId={}: {}", userId, e.getMessage());
            return null; // swallow — never block evaluate response
        }
    }

    public Map<String, Object> onJDParsed(String userId) {
        try {
            if (userId == null) return null;
            UserStats stats = userStatsRepository.findByUserId(userId).orElse(null);
            if (stats == null) {
                stats = new UserStats();
                stats.setUserId(userId);
            }
            int parsed = (stats.getJdsParsed() != null ? stats.getJdsParsed() : 0) + 1;
            stats.setJdsParsed(parsed);

            if (parsed >= 3) {
                Set<String> earned = getBadgeIds(stats.getBadges());
                if (!earned.contains("jd_parser")) {
                    Badge badge = makeBadge("jd_parser");
                    List<Badge> badges = new ArrayList<>(stats.getBadges() != null ? stats.getBadges() : List.of());
                    badges.add(badge);
                    stats.setBadges(badges);
                    userStatsRepository.save(stats);
                    return Map.of("newBadge", Map.of("id", "jd_parser",
                            "name", ALL_BADGES.get("jd_parser").get("name"),
                            "icon", ALL_BADGES.get("jd_parser").get("icon")));
                }
            }
            userStatsRepository.save(stats);
        } catch (Exception e) {
            log.error("onJDParsed gamification error: {}", e.getMessage());
        }
        return null;
    }

    public Map<String, Object> onResumeCompare(String userId) {
        try {
            if (userId == null) return null;
            UserStats stats = userStatsRepository.findByUserId(userId).orElse(null);
            if (stats == null) {
                stats = new UserStats();
                stats.setUserId(userId);
            }
            int compares = (stats.getResumeComparesRun() != null ? stats.getResumeComparesRun() : 0) + 1;
            stats.setResumeComparesRun(compares);

            if (compares == 1) {
                Set<String> earned = getBadgeIds(stats.getBadges());
                if (!earned.contains("resume_checker")) {
                    Badge badge = makeBadge("resume_checker");
                    List<Badge> badges = new ArrayList<>(stats.getBadges() != null ? stats.getBadges() : List.of());
                    badges.add(badge);
                    stats.setBadges(badges);
                    userStatsRepository.save(stats);
                    return Map.of("newBadge", Map.of("id", "resume_checker",
                            "name", ALL_BADGES.get("resume_checker").get("name"),
                            "icon", ALL_BADGES.get("resume_checker").get("icon")));
                }
            }
            userStatsRepository.save(stats);
        } catch (Exception e) {
            log.error("onResumeCompare gamification error: {}", e.getMessage());
        }
        return null;
    }

    // ── Pure helper methods ───────────────────────────────────────────

    public static int computeLevel(int xp) {
        int level = 1;
        for (int i = LEVELS.length - 1; i >= 1; i--) {
            if (xp >= LEVELS[i]) { level = i + 1; break; }
        }
        return Math.min(level, LEVELS.length);
    }

    private Map<String, Object> computeStreak(UserStats stats) {
        String today     = LocalDate.now(ZoneOffset.UTC).toString();
        String yesterday = LocalDate.now(ZoneOffset.UTC).minusDays(1).toString();
        String last      = stats.getLastPracticeDate();

        int current = stats.getCurrentStreak() != null ? stats.getCurrentStreak() : 0;
        int longest = stats.getLongestStreak()  != null ? stats.getLongestStreak()  : 0;

        if (today.equals(last)) {
            // Already counted — no change
        } else if (yesterday.equals(last)) {
            current += 1;
        } else {
            current = 1;
        }

        longest = Math.max(longest, current);
        return Map.of("currentStreak", current, "longestStreak", longest, "lastPracticeDate", today);
    }

    private Map<String, Object> computeXP(Map<String, Object> session, int newStreak) {
        List<Map<String, Object>> breakdown = new ArrayList<>();
        breakdown.add(Map.of("event", "Session complete", "xp", 20));

        double score = toDouble(session.get("overallScore"));
        if (score >= 6.5) breakdown.add(Map.of("event", "Pass (≥ 6.5)", "xp", 30));
        if (score >= 8.0) breakdown.add(Map.of("event", "Excellent (≥ 8.0)", "xp", 20));

        int durationSeconds = toInt(session.get("durationSeconds"));
        int durMins         = durationSeconds / 60;
        int durBonus        = (durMins / 10) * 5;
        if (durBonus > 0) breakdown.add(Map.of("event", "Duration bonus (" + durMins + " min)", "xp", durBonus));

        if (session.get("jdSessionId") != null) breakdown.add(Map.of("event", "Used JD", "xp", 10));
        if (session.get("personaId")   != null) breakdown.add(Map.of("event", "Used Persona", "xp", 10));

        if (newStreak >= 7)      breakdown.add(Map.of("event", "7-day streak bonus", "xp", 30));
        else if (newStreak >= 3) breakdown.add(Map.of("event", "3-day streak bonus", "xp", 15));

        int total = breakdown.stream().mapToInt(m -> (int) m.get("xp")).sum();
        return Map.of("total", total, "breakdown", breakdown);
    }

    @SuppressWarnings("unchecked")
    private List<Badge> checkBadges(Map<String, Object> snap, Map<String, Object> session,
                                     SpeechMetrics speech, int newLevel, Double prevScore) {
        Set<String> already = getBadgeIds((List<Badge>) snap.get("badges"));
        List<Badge> toAward = new ArrayList<>();

        double score        = toDouble(session.get("overallScore"));
        int totalSessions   = (int) snap.get("totalSessions");
        int streak          = (int) snap.get("currentStreak");
        int hourUTC         = Instant.now().atZone(ZoneOffset.UTC).getHour();

        // Session milestones
        if (totalSessions >= 1)   tryAward("first_session",     already, toAward);
        if (totalSessions >= 10)  tryAward("ten_sessions",      already, toAward);
        if (totalSessions >= 50)  tryAward("fifty_sessions",    already, toAward);
        if (totalSessions >= 100) tryAward("century",           already, toAward);

        // Score
        if (score >= 6.5) tryAward("first_pass",    already, toAward);
        if (score >= 8.0) tryAward("high_achiever", already, toAward);
        if (score >= 9.5) tryAward("perfect_ten",   already, toAward);
        if (score >= 7.0 && prevScore != null && prevScore < 5.0) tryAward("comeback_kid", already, toAward);

        // Streaks
        if (streak >= 3)  tryAward("streak_3",  already, toAward);
        if (streak >= 7)  tryAward("streak_7",  already, toAward);
        if (streak >= 14) tryAward("streak_14", already, toAward);
        if (streak >= 30) tryAward("streak_30", already, toAward);

        // Domains / personas
        List<String> domains  = (List<String>) snap.get("domainsPlayed");
        List<String> personas = (List<String>) snap.get("personasUsed");
        if (domains  != null && domains.size()  >= 3) tryAward("domain_explorer",   already, toAward);
        if (domains  != null && domains.size()  >= 5) tryAward("polymath",          already, toAward);
        if (personas != null && personas.containsAll(ALL_PERSONAS)) tryAward("persona_collector", already, toAward);

        // Speech
        if (speech != null) {
            int fillers = speech.getTotalFillers() != null ? speech.getTotalFillers() : -1;
            double wpm  = speech.getWordsPerMinute() != null ? speech.getWordsPerMinute() : 0;
            if (fillers >= 0 && fillers < 3)         tryAward("no_fillers",    already, toAward);
            if (wpm > 150)                           tryAward("speed_demon",   already, toAward);
            if (wpm >= 120 && wpm <= 150)            tryAward("slow_and_steady", already, toAward);
        }

        // Level / XP
        if (newLevel >= 5)  tryAward("level_5",  already, toAward);
        if (newLevel >= 10) tryAward("level_10", already, toAward);
        int currentXp = (int) snap.get("xp");
        if (currentXp >= 500) tryAward("xp_500", already, toAward);

        // Time-based
        if (hourUTC >= 22 || hourUTC < 4)    tryAward("night_owl",  already, toAward);
        if (hourUTC >= 5  && hourUTC < 7)    tryAward("early_bird", already, toAward);

        // Feature
        int jdsParsed = (int) snap.get("jdsParsed");
        if (jdsParsed >= 3) tryAward("jd_parser", already, toAward);

        return toAward;
    }

    private void tryAward(String id, Set<String> already, List<Badge> toAward) {
        if (!already.contains(id) && toAward.stream().noneMatch(b -> id.equals(b.getId()))) {
            toAward.add(makeBadge(id));
        }
    }

    private Badge makeBadge(String id) {
        Map<String, String> meta = ALL_BADGES.get(id);
        Badge badge = new Badge();
        badge.setId(id);
        badge.setName(meta != null ? meta.get("name") : id);
        badge.setDescription(meta != null ? meta.get("description") : "");
        badge.setIcon(meta != null ? meta.get("icon") : "🏅");
        badge.setUnlockedAt(Instant.now());
        return badge;
    }

    private Set<String> getBadgeIds(List<Badge> badges) {
        Set<String> ids = new HashSet<>();
        if (badges != null) badges.forEach(b -> ids.add(b.getId()));
        return ids;
    }

    private Double getPreviousSessionScore(String userId, String excludeSessionId) {
        try {
            List<Session> sessions = sessionRepository.findByUserId(userId);
            return sessions.stream()
                    .filter(s -> "completed".equals(s.getStatus()))
                    .filter(s -> !s.getId().equals(excludeSessionId))
                    .max(Comparator.comparing(Session::getCreatedAt))
                    .map(s -> s.getOverallScore())
                    .orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    private static Map<String, String> badge(String name, String description, String icon) {
        Map<String, String> m = new HashMap<>();
        m.put("name", name);
        m.put("description", description);
        m.put("icon", icon);
        return m;
    }

    private double toDouble(Object o) {
        if (o == null) return 0.0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(o.toString()); } catch (Exception e) { return 0.0; }
    }

    private int toInt(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.intValue();
        try { return Integer.parseInt(o.toString()); } catch (Exception e) { return 0; }
    }
}
