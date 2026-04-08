package com.teamzemo.quasar.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.teamzemo.quasar.dto.ApiResponse;
import com.teamzemo.quasar.model.*;
import com.teamzemo.quasar.repository.*;
import com.teamzemo.quasar.security.UserPrincipal;
import com.teamzemo.quasar.service.GamificationService;
import com.teamzemo.quasar.service.GroqService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api")
public class EvaluationController {

    private static final Logger log = LoggerFactory.getLogger(EvaluationController.class);

    private final SessionRepository      sessionRepository;
    private final SpeechMetricsRepository speechMetricsRepository;
    private final PersonaRepository       personaRepository;
    private final SkillVectorRepository   skillVectorRepository;
    private final GamificationService     gamificationService;
    private final GroqService             groqService;
    private final ObjectMapper            objectMapper = new ObjectMapper();

    private static final String EVALUATION_SYSTEM_PROMPT = """
            You are an expert interview evaluator. Analyse the provided interview transcript and return ONLY valid JSON (no markdown, no code fences) matching this exact schema:
            {
              "overallScore": number (0-10, one decimal),
              "starScores": {
                "situation": number (0-10),
                "task": number (0-10),
                "action": number (0-10),
                "result": number (0-10),
                "conciseness": number (0-10),
                "domain_knowledge": number (0-10)
              },
              "clarityScore": number (0-10),
              "categoryScores": {
                "communication": number (0-10),
                "technical_depth": number (0-10),
                "leadership": number (0-10),
                "problem_structuring": number (0-10),
                "result_orientation": number (0-10),
                "culture_fit": number (0-10)
              },
              "strengths": [string, string, string],
              "improvements": [string, string, string],
              "summary": string (2-3 sentence assessment)
            }""";

    public EvaluationController(SessionRepository sessionRepository,
                                 SpeechMetricsRepository speechMetricsRepository,
                                 PersonaRepository personaRepository,
                                 SkillVectorRepository skillVectorRepository,
                                 GamificationService gamificationService,
                                 GroqService groqService) {
        this.sessionRepository       = sessionRepository;
        this.speechMetricsRepository = speechMetricsRepository;
        this.personaRepository       = personaRepository;
        this.skillVectorRepository   = skillVectorRepository;
        this.gamificationService      = gamificationService;
        this.groqService              = groqService;
    }

    /** POST /api/sessions/:sessionId/evaluate */
    @PostMapping("/sessions/{sessionId}/evaluate")
    public ResponseEntity<ApiResponse<Map<String, Object>>> evaluateSession(
            @PathVariable String sessionId,
            @AuthenticationPrincipal UserPrincipal principal) {
        try {
            Session session = sessionRepository.findById(sessionId).orElse(null);
            if (session == null) {
                return ResponseEntity.status(404).body(ApiResponse.fail("Session not found"));
            }

            String personaName = "Default Interviewer";
            if (session.getPersonaId() != null) {
                Persona persona = personaRepository.findById(session.getPersonaId()).orElse(null);
                if (persona != null) personaName = persona.getName();
            }

            SpeechMetrics speechDoc = speechMetricsRepository.findBySessionId(sessionId).orElse(null);
            String transcript = speechDoc != null && speechDoc.getTranscript() != null
                    ? speechDoc.getTranscript()
                    : (session.getTranscript() != null ? session.getTranscript() : "");

            if (transcript.trim().length() < 20) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.fail("Insufficient transcript for evaluation"));
            }

            String userPrompt = "Domain: " + (session.getDomain() != null ? session.getDomain() : "General") +
                    "\nPersona: " + personaName +
                    "\n\nTranscript:\n" + transcript.substring(0, Math.min(8000, transcript.length()));

            String responseText = groqService.chatCompletion(
                    EVALUATION_SYSTEM_PROMPT, userPrompt,
                    "llama-3.3-70b-versatile", 0.3, 4096);

            String clean = stripMarkdownFences(responseText);
            Map<String, Object> scores;
            try {
                scores = objectMapper.readValue(clean, new TypeReference<Map<String, Object>>() {});
            } catch (Exception parseErr) {
                log.error("Failed to parse Groq evaluation response: {}", parseErr.getMessage());
                return ResponseEntity.status(502)
                        .body(ApiResponse.fail("AI returned invalid evaluation. Try again."));
            }

            // Calculate duration
            int durationSeconds = session.getDurationSeconds() != null ? session.getDurationSeconds() : 0;
            if (durationSeconds == 0 && session.getStartedAt() != null) {
                durationSeconds = (int) ((Instant.now().toEpochMilli()
                        - session.getStartedAt().toEpochMilli()) / 1000);
            }

            // Save scores to session
            session.setStatus("completed");
            session.setOverallScore(toDouble(scores.get("overallScore")));
            session.setStarScores(tryCastMap(scores.get("starScores")));
            session.setClarityScore(toDouble(scores.get("clarityScore")));
            session.setTranscript(transcript);
            session.setDurationSeconds(durationSeconds);
            if (session.getEndedAt() == null) session.setEndedAt(Instant.now());
            sessionRepository.save(session);

            // Update skill vectors
            String userId = session.getUserId();
            if (userId != null) {
                Map<String, Object> categoryScores = tryCastMap(scores.get("categoryScores"));
                if (categoryScores != null) {
                    for (Map.Entry<String, Object> entry : categoryScores.entrySet()) {
                        String skill = entry.getKey();
                        double score = toDouble(entry.getValue());
                        double clamped = Math.max(0, Math.min(10, score));

                        SkillVector existing = skillVectorRepository
                                .findByUserIdAndSkill(userId, skill).orElse(null);
                        if (existing != null) {
                            double newScore = Math.round((0.7 * existing.getScore() + 0.3 * clamped) * 100.0) / 100.0;
                            existing.setScore(newScore);
                            existing.setAttemptCount(existing.getAttemptCount() + 1);
                            existing.setLastUpdated(Instant.now());
                            skillVectorRepository.save(existing);
                        } else {
                            SkillVector sv = new SkillVector();
                            sv.setUserId(userId);
                            sv.setSkill(skill);
                            sv.setScore(clamped);
                            sv.setAttemptCount(1);
                            skillVectorRepository.save(sv);
                        }
                    }
                }
            }

            // Gamification (swallowed)
            Map<String, Object> sessionDataForGamification = Map.of(
                    "sessionId",       sessionId,
                    "overallScore",    scores.getOrDefault("overallScore", 0),
                    "durationSeconds", durationSeconds,
                    "domain",          session.getDomain() != null ? session.getDomain() : "",
                    "personaId",       session.getPersonaId() != null ? session.getPersonaId() : "",
                    "jdSessionId",     session.getJdSessionId() != null ? session.getJdSessionId() : ""
            );
            Map<String, Object> gamification = null;
            if (userId != null) {
                gamification = gamificationService.processSession(userId, sessionDataForGamification);
            }

            double overallScore = toDouble(scores.get("overallScore"));
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("overallScore",   overallScore);
            data.put("starScores",     scores.get("starScores"));
            data.put("clarityScore",   scores.get("clarityScore"));
            data.put("categoryScores", scores.get("categoryScores"));
            data.put("strengths",      scores.get("strengths"));
            data.put("improvements",   scores.get("improvements"));
            data.put("summary",        scores.get("summary"));
            data.put("passed",         overallScore >= 6.5);
            data.put("gamification",   gamification);

            return ResponseEntity.ok(ApiResponse.ok("Session evaluated", data));

        } catch (Exception e) {
            log.error("Evaluate session error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to evaluate session"));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private static String stripMarkdownFences(String text) {
        text = text.trim();
        if (text.startsWith("```")) {
            text = text.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("```\\s*$", "").trim();
        }
        return text;
    }

    private double toDouble(Object o) {
        if (o == null) return 0.0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(o.toString()); } catch (Exception e) { return 0.0; }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> tryCastMap(Object o) {
        if (o instanceof Map) return (Map<String, Object>) o;
        return null;
    }
}
