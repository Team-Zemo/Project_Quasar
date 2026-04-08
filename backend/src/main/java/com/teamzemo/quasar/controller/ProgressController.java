package com.teamzemo.quasar.controller;

import com.teamzemo.quasar.dto.ApiResponse;
import com.teamzemo.quasar.model.Session;
import com.teamzemo.quasar.model.SpeechMetrics;
import com.teamzemo.quasar.repository.SessionRepository;
import com.teamzemo.quasar.repository.SpeechMetricsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class ProgressController {

    private static final Logger log = LoggerFactory.getLogger(ProgressController.class);

    private final SessionRepository       sessionRepository;
    private final SpeechMetricsRepository speechMetricsRepository;

    public ProgressController(SessionRepository sessionRepository,
                               SpeechMetricsRepository speechMetricsRepository) {
        this.sessionRepository       = sessionRepository;
        this.speechMetricsRepository = speechMetricsRepository;
    }

    /** GET /api/users/:userId/progress */
    @GetMapping("/users/{userId}/progress")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProgress(@PathVariable String userId) {
        try {
            List<Session> sessionsRaw =
                    sessionRepository.findByUserIdAndStatusOrderByStartedAtAsc(userId, "completed");

            List<String> sessionIds = sessionsRaw.stream()
                    .map(Session::getId).collect(Collectors.toList());

            Map<String, SpeechMetrics> speechMap = new HashMap<>();
            if (!sessionIds.isEmpty()) {
                speechMetricsRepository.findBySessionIdIn(sessionIds)
                        .forEach(sm -> speechMap.put(sm.getSessionId(), sm));
            }

            List<Map<String, Object>> sessions = sessionsRaw.stream().map(row -> {
                Map<String, Object> star  = row.getStarScores() != null ? row.getStarScores() : Map.of();
                List<?> emotions          = row.getEmotionMetrics() != null ? row.getEmotionMetrics() : List.of();
                SpeechMetrics sm          = speechMap.getOrDefault(row.getId(), null);

                // Confidence average
                int confAvg = 0;
                if (!emotions.isEmpty()) {
                    double sum = emotions.stream().mapToDouble(e -> {
                        if (e instanceof Map<?, ?> m) {
                            Object c = m.get("confidence");
                            return c instanceof Number n ? n.doubleValue() : 0;
                        }
                        return 0;
                    }).sum();
                    confAvg = (int) Math.round(sum / emotions.size());
                }

                // Filler rate per minute
                double durationMinutes = (row.getDurationSeconds() != null ? row.getDurationSeconds() : 0) / 60.0;
                int totalFillers = (sm != null && sm.getTotalFillers() != null) ? sm.getTotalFillers() : 0;
                double fillerRate = durationMinutes > 0
                        ? Math.round((totalFillers / durationMinutes) * 10.0) / 10.0 : 0;

                Map<String, Object> m = new LinkedHashMap<>();
                m.put("sessionId",     row.getId());
                m.put("date",          row.getStartedAt());
                m.put("overallScore",  row.getOverallScore() != null ? row.getOverallScore() : 0.0);
                m.put("starScores", Map.of(
                        "situation", toDouble(star.get("situation")),
                        "task",      toDouble(star.get("task")),
                        "action",    toDouble(star.get("action")),
                        "result",    toDouble(star.get("result"))
                ));
                m.put("clarityScore",  row.getClarityScore() != null ? row.getClarityScore() : 0.0);
                m.put("fillerRate",    fillerRate);
                m.put("confidenceAvg", confAvg);
                m.put("domain",        row.getDomain());
                m.put("personaId",     row.getPersonaId());
                return m;
            }).collect(Collectors.toList());

            // Improvement metrics
            Map<String, Object> improvement = new LinkedHashMap<>();
            improvement.put("clarityDelta",       "No data yet");
            improvement.put("strongestDimension", "N/A");
            improvement.put("weakestDimension",   "N/A");

            if (!sessions.isEmpty()) {
                Map<String, Double> dimTotals = new LinkedHashMap<>();
                dimTotals.put("situation", 0.0);
                dimTotals.put("task",      0.0);
                dimTotals.put("action",    0.0);
                dimTotals.put("result",    0.0);

                for (Map<String, Object> s : sessions) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> ss = (Map<String, Object>) s.get("starScores");
                    for (String k : dimTotals.keySet()) {
                        dimTotals.put(k, dimTotals.get(k) + toDouble(ss.get(k)));
                    }
                }

                double n = sessions.size();
                List<Map.Entry<String, Double>> dims = dimTotals.entrySet().stream()
                        .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                        .collect(Collectors.toList());

                improvement.put("strongestDimension", dims.get(0).getKey());
                improvement.put("weakestDimension",   dims.get(dims.size() - 1).getKey());

                if (sessions.size() == 1) {
                    double cs = toDouble(sessions.get(0).get("clarityScore"));
                    improvement.put("clarityDelta", cs + "/10 (first session)");
                } else {
                    double latest = toDouble(sessions.get(sessions.size() - 1).get("clarityScore"));
                    double prevAvg = sessions.subList(0, sessions.size() - 1).stream()
                            .mapToDouble(s -> toDouble(s.get("clarityScore"))).average().orElse(0);
                    double delta = Math.round((latest - prevAvg) * 10.0) / 10.0;
                    int prevCount = sessions.size() - 1;
                    improvement.put("clarityDelta", (delta >= 0 ? "+" : "") + delta +
                            " vs previous " + prevCount + " session" + (prevCount > 1 ? "s" : ""));
                }
            }

            return ResponseEntity.ok(ApiResponse.ok("Progress retrieved", Map.of(
                    "sessions",      sessions,
                    "improvement",   improvement,
                    "totalSessions", sessions.size()
            )));
        } catch (Exception e) {
            log.error("Get progress error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to get progress"));
        }
    }

    private double toDouble(Object o) {
        if (o == null) return 0.0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(o.toString()); } catch (Exception e) { return 0.0; }
    }
}
