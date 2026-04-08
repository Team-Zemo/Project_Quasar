package com.teamzemo.quasar.controller;

import com.teamzemo.quasar.dto.ApiResponse;
import com.teamzemo.quasar.dto.UpdateSkillVectorRequest;
import com.teamzemo.quasar.model.JdQuestion;
import com.teamzemo.quasar.model.JdSession;
import com.teamzemo.quasar.model.Session;
import com.teamzemo.quasar.model.SkillVector;
import com.teamzemo.quasar.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class SkillController {

    private static final Logger log = LoggerFactory.getLogger(SkillController.class);

    private final SkillVectorRepository  skillVectorRepository;
    private final SessionRepository       sessionRepository;
    private final JdQuestionRepository    jdQuestionRepository;
    private final JdSessionRepository     jdSessionRepository;

    // STAR dimension → skill mapping (mirrors JS STAR_SKILL_MAP)
    private static final Map<String, String> STAR_SKILL_MAP = Map.of(
            "situation", "communication",
            "task",      "problem_structuring",
            "action",    "leadership",
            "result",    "result_orientation"
    );

    // Category → skill mapping (mirrors JS CATEGORY_SKILL_MAP)
    private static final Map<String, String> CATEGORY_SKILL_MAP = Map.of(
            "technical",    "technical_depth",
            "system-design","technical_depth",
            "behavioural",  "communication",
            "culture-fit",  "culture_fit"
    );

    public SkillController(SkillVectorRepository skillVectorRepository,
                            SessionRepository sessionRepository,
                            JdQuestionRepository jdQuestionRepository,
                            JdSessionRepository jdSessionRepository) {
        this.skillVectorRepository = skillVectorRepository;
        this.sessionRepository     = sessionRepository;
        this.jdQuestionRepository  = jdQuestionRepository;
        this.jdSessionRepository   = jdSessionRepository;
    }

    /** POST /api/users/:userId/skill-vector/update */
    @PostMapping("/users/{userId}/skill-vector/update")
    public ResponseEntity<ApiResponse<List<SkillVector>>> updateSkillVector(
            @PathVariable String userId,
            @RequestBody UpdateSkillVectorRequest req) {
        try {
            if (req.getStarScores() == null && req.getCategoryScores() == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.fail("starScores or categoryScores required"));
            }

            List<Map.Entry<String, Double>> updates = new ArrayList<>();

            if (req.getStarScores() != null) {
                for (Map.Entry<String, Object> e : req.getStarScores().entrySet()) {
                    String skill = STAR_SKILL_MAP.get(e.getKey().toLowerCase());
                    if (skill != null && e.getValue() instanceof Number n) {
                        updates.add(Map.entry(skill, clamp(n.doubleValue())));
                    }
                }
            }

            if (req.getCategoryScores() != null) {
                for (Map.Entry<String, Object> e : req.getCategoryScores().entrySet()) {
                    String skill = CATEGORY_SKILL_MAP.get(e.getKey().toLowerCase());
                    if (skill != null && e.getValue() instanceof Number n) {
                        updates.add(Map.entry(skill, clamp(n.doubleValue())));
                    }
                }
            }

            for (Map.Entry<String, Double> update : updates) {
                applyEMA(userId, update.getKey(), update.getValue());
            }

            List<SkillVector> result = skillVectorRepository.findByUserIdOrderBySkillAsc(userId);
            return ResponseEntity.ok(ApiResponse.ok("Skill vector updated", result));
        } catch (Exception e) {
            log.error("Update skill vector error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to update skill vector"));
        }
    }

    /** GET /api/users/:userId/skill-vector */
    @GetMapping("/users/{userId}/skill-vector")
    public ResponseEntity<ApiResponse<List<SkillVector>>> getSkillVector(@PathVariable String userId) {
        try {
            List<SkillVector> result = skillVectorRepository.findByUserIdOrderBySkillAsc(userId);
            return ResponseEntity.ok(ApiResponse.ok("Skill vector retrieved", result));
        } catch (Exception e) {
            log.error("Get skill vector error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to get skill vector"));
        }
    }

    /** GET /api/sessions/:sessionId/next-question */
    @GetMapping("/sessions/{sessionId}/next-question")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getNextQuestion(@PathVariable String sessionId) {
        try {
            Session session = sessionRepository.findById(sessionId).orElse(null);
            if (session == null) {
                return ResponseEntity.status(404).body(ApiResponse.fail("Session not found"));
            }

            String userId      = session.getUserId();
            String jdSessionId = session.getJdSessionId();

            if (userId == null) {
                return ResponseEntity.badRequest().body(ApiResponse.fail("Session has no user"));
            }

            // Get weakest skills
            List<SkillVector> skills = skillVectorRepository.findByUserIdOrderByScoreAsc(userId);
            List<String> weakestSkills = skills.stream().limit(2)
                    .map(SkillVector::getSkill).collect(Collectors.toList());

            // Build target skill terms
            Set<String> targetSkillTerms = new HashSet<>(weakestSkills);
            for (String ws : weakestSkills) {
                STAR_SKILL_MAP.forEach((k, v) -> { if (v.equals(ws)) targetSkillTerms.add(k); });
                CATEGORY_SKILL_MAP.forEach((k, v) -> { if (v.equals(ws)) targetSkillTerms.add(k); });
            }

            // Load questions
            List<JdQuestion> questions;
            if (jdSessionId != null) {
                questions = jdQuestionRepository.findByJdSessionIdOrderByWeightDesc(jdSessionId);
            } else {
                List<String> jdIds = jdSessionRepository.findByUserId(userId).stream()
                        .map(JdSession::getId).collect(Collectors.toList());
                questions = jdIds.isEmpty() ? List.of()
                        : jdQuestionRepository.findByJdSessionIdInOrderByWeightDesc(jdIds)
                                .stream().limit(50).collect(Collectors.toList());
            }

            if (questions.isEmpty()) {
                return ResponseEntity.ok(ApiResponse.ok("No questions available", null));
            }

            // Score each question
            List<Map.Entry<JdQuestion, Double>> scored = questions.stream().map(q -> {
                double priority = q.getWeight() != null ? q.getWeight() : 0.5;
                String tl = q.getTargetSkill() != null ? q.getTargetSkill().toLowerCase() : "";
                if (targetSkillTerms.contains(tl)) priority += 0.3;
                if (q.getLastAttemptedSession() == null)   priority += 0.2;
                else if (q.getLastScore() != null && q.getLastScore() < 6) priority += 0.15;
                return Map.entry(q, priority);
            }).sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
              .collect(Collectors.toList());

            JdQuestion selected  = scored.get(0).getKey();
            String     targetLow = selected.getTargetSkill() != null
                    ? selected.getTargetSkill().toLowerCase() : "";

            String reason = "Highest priority question";
            if (targetSkillTerms.contains(targetLow)) {
                String matchedWeak = weakestSkills.stream()
                        .filter(ws -> ws.equals(targetLow)
                                || STAR_SKILL_MAP.getOrDefault(targetLow, "").equals(ws)
                                || CATEGORY_SKILL_MAP.getOrDefault(targetLow, "").equals(ws))
                        .findFirst().orElse(null);
                if (matchedWeak != null) {
                    double weakScore = skills.stream()
                            .filter(sv -> sv.getSkill().equals(matchedWeak))
                            .mapToDouble(SkillVector::getScore).findFirst().orElse(5.0);
                    reason = "Targets your weakest skill: " + matchedWeak + " (score: " + weakScore + "/10)";
                }
            }

            return ResponseEntity.ok(ApiResponse.ok("Next question selected", Map.of(
                    "question",    selected.getQuestion(),
                    "difficulty",  selected.getDifficulty(),
                    "targetSkill", selected.getTargetSkill() != null ? selected.getTargetSkill() : "",
                    "category",    selected.getCategory() != null ? selected.getCategory() : "",
                    "reason",      reason,
                    "questionId",  selected.getId()
            )));
        } catch (Exception e) {
            log.error("Get next question error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to get next question"));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private void applyEMA(String userId, String skill, double score) {
        SkillVector existing = skillVectorRepository.findByUserIdAndSkill(userId, skill).orElse(null);
        if (existing != null) {
            double newScore = Math.round((0.7 * existing.getScore() + 0.3 * score) * 100.0) / 100.0;
            existing.setScore(newScore);
            existing.setAttemptCount(existing.getAttemptCount() + 1);
            existing.setLastUpdated(Instant.now());
            skillVectorRepository.save(existing);
        } else {
            SkillVector sv = new SkillVector();
            sv.setUserId(userId);
            sv.setSkill(skill);
            sv.setScore(score);
            sv.setAttemptCount(1);
            skillVectorRepository.save(sv);
        }
    }

    private double clamp(double v) { return Math.max(0, Math.min(10, v)); }
}
