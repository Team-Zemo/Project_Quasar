package com.teamzemo.quasar.controller;

import com.teamzemo.quasar.dto.*;
import com.teamzemo.quasar.model.Persona;
import com.teamzemo.quasar.model.Session;
import com.teamzemo.quasar.repository.PersonaRepository;
import com.teamzemo.quasar.repository.SessionRepository;
import com.teamzemo.quasar.security.UserPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class SessionController {

    private static final Logger log = LoggerFactory.getLogger(SessionController.class);

    private final SessionRepository sessionRepository;
    private final PersonaRepository personaRepository;

    public SessionController(SessionRepository sessionRepository,
                              PersonaRepository personaRepository) {
        this.sessionRepository = sessionRepository;
        this.personaRepository = personaRepository;
    }

    // ── POST /api/sessions ───────────────────────────────────────────

    @PostMapping("/sessions")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createSession(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody CreateSessionRequest req) {
        try {
            if (req.getDomain() == null || req.getDomain().isBlank()) {
                return ResponseEntity.badRequest().body(ApiResponse.fail("Domain is required"));
            }

            Session session = new Session();
            session.setUserId(principal.getId());
            session.setDomain(req.getDomain());
            session.setPersonaId(req.getPersonaId());
            session.setJdSessionId(req.getJdSessionId());
            session.setStatus("active");
            session = sessionRepository.save(session);

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.ok("Session created", Map.of(
                            "id",         session.getId(),
                            "user_id",    session.getUserId(),
                            "domain",     session.getDomain(),
                            "persona_id", session.getPersonaId() != null ? session.getPersonaId() : "",
                            "status",     session.getStatus(),
                            "started_at", session.getStartedAt()
                    )));
        } catch (Exception e) {
            log.error("Create session error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to create session"));
        }
    }

    // ── POST /api/sessions/:sessionId/end ────────────────────────────

    @PostMapping("/sessions/{sessionId}/end")
    public ResponseEntity<ApiResponse<Session>> endSession(
            @PathVariable String sessionId,
            @RequestBody EndSessionRequest req) {
        try {
            Session session = sessionRepository.findById(sessionId).orElse(null);
            if (session == null) {
                return ResponseEntity.status(404).body(ApiResponse.fail("Session not found"));
            }

            session.setEndedAt(Instant.now());
            if (!"completed".equals(session.getStatus())) {
                session.setStatus("completed");
            }
            if (req.getOverallScore() != null)  session.setOverallScore(req.getOverallScore());
            if (req.getStarScores()  != null && !req.getStarScores().isEmpty())
                session.setStarScores(req.getStarScores());
            if (req.getClarityScore() != null)  session.setClarityScore(req.getClarityScore());
            if (req.getTranscript()   != null)  session.setTranscript(req.getTranscript());
            if (req.getDurationSeconds() != null) session.setDurationSeconds(req.getDurationSeconds());

            session = sessionRepository.save(session);
            return ResponseEntity.ok(ApiResponse.ok("Session ended", session));
        } catch (Exception e) {
            log.error("End session error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to end session"));
        }
    }

    // ── GET /api/sessions/:sessionId ─────────────────────────────────

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSession(@PathVariable String sessionId) {
        try {
            Session session = sessionRepository.findById(sessionId).orElse(null);
            if (session == null) {
                return ResponseEntity.status(404).body(ApiResponse.fail("Session not found"));
            }

            String personaName = null, personaDescription = null;
            if (session.getPersonaId() != null) {
                Persona persona = personaRepository.findById(session.getPersonaId()).orElse(null);
                if (persona != null) {
                    personaName        = persona.getName();
                    personaDescription = persona.getDescription();
                }
            }

            Map<String, Object> data = new LinkedHashMap<>();
            data.put("id",                  session.getId());
            data.put("userId",              session.getUserId());
            data.put("domain",              session.getDomain());
            data.put("personaId",           session.getPersonaId());
            data.put("jdSessionId",         session.getJdSessionId());
            data.put("status",              session.getStatus());
            data.put("overallScore",        session.getOverallScore());
            data.put("starScores",          session.getStarScores());
            data.put("clarityScore",        session.getClarityScore());
            data.put("transcript",          session.getTranscript());
            data.put("durationSeconds",     session.getDurationSeconds());
            data.put("startedAt",           session.getStartedAt());
            data.put("endedAt",             session.getEndedAt());
            data.put("emotionMetrics",      session.getEmotionMetrics());
            data.put("persona_name",        personaName);
            data.put("persona_description", personaDescription);

            return ResponseEntity.ok(ApiResponse.ok("Session retrieved", data));
        } catch (Exception e) {
            log.error("Get session error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to get session"));
        }
    }

    // ── GET /api/user/sessions ───────────────────────────────────────

    @GetMapping("/user/sessions")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getUserSessions(
            @AuthenticationPrincipal UserPrincipal principal) {
        try {
            List<Session> sessions = sessionRepository.findByUserIdOrderByCreatedAtDesc(principal.getId());

            // Batch-load personas
            Set<String> personaIds = sessions.stream()
                    .filter(s -> s.getPersonaId() != null)
                    .map(Session::getPersonaId)
                    .collect(Collectors.toSet());

            Map<String, String> personaMap = new HashMap<>();
            if (!personaIds.isEmpty()) {
                personaRepository.findAllById(personaIds)
                        .forEach(p -> personaMap.put(p.getId(), p.getName()));
            }

            List<Map<String, Object>> result = sessions.stream().map(s -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id",               s.getId());
                m.put("domain",           s.getDomain());
                m.put("persona_name",     personaMap.getOrDefault(s.getPersonaId(), null));
                m.put("status",           s.getStatus());
                m.put("overall_score",    s.getOverallScore());
                m.put("star_scores",      s.getStarScores());
                m.put("clarity_score",    s.getClarityScore());
                m.put("duration_seconds", s.getDurationSeconds());
                m.put("started_at",       s.getStartedAt());
                m.put("ended_at",         s.getEndedAt());
                return m;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(ApiResponse.ok("Sessions retrieved", result));
        } catch (Exception e) {
            log.error("Get user sessions error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to get sessions"));
        }
    }

    // ── POST /api/sessions/:sessionId/emotion-metrics ────────────────

    @PostMapping("/sessions/{sessionId}/emotion-metrics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> saveEmotionMetrics(
            @PathVariable String sessionId,
            @RequestBody EmotionMetricsRequest req) {
        try {
            if (req.getMetrics() == null) {
                return ResponseEntity.badRequest().body(ApiResponse.fail("metrics must be an array"));
            }

            Session session = sessionRepository.findById(sessionId).orElse(null);
            if (session == null) {
                return ResponseEntity.status(404).body(ApiResponse.fail("Session not found"));
            }

            session.setEmotionMetrics(req.getMetrics());
            sessionRepository.save(session);
            return ResponseEntity.ok(ApiResponse.ok("Emotion metrics saved",
                    Map.of("sessionId", sessionId)));
        } catch (Exception e) {
            log.error("Save emotion metrics error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to save emotion metrics"));
        }
    }

    // ── GET /api/sessions/:sessionId/emotion-metrics ─────────────────

    @GetMapping("/sessions/{sessionId}/emotion-metrics")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getEmotionMetrics(
            @PathVariable String sessionId) {
        try {
            Session session = sessionRepository.findById(sessionId).orElse(null);
            if (session == null) {
                return ResponseEntity.status(404).body(ApiResponse.fail("Session not found"));
            }
            List<Map<String, Object>> metrics = session.getEmotionMetrics() != null
                    ? session.getEmotionMetrics() : List.of();
            return ResponseEntity.ok(ApiResponse.ok("Emotion metrics retrieved", metrics));
        } catch (Exception e) {
            log.error("Get emotion metrics error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to get emotion metrics"));
        }
    }
}
