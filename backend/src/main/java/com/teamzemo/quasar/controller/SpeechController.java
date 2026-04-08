package com.teamzemo.quasar.controller;

import com.teamzemo.quasar.dto.ApiResponse;
import com.teamzemo.quasar.dto.SpeechMetricsRequest;
import com.teamzemo.quasar.model.Session;
import com.teamzemo.quasar.model.SpeechMetrics;
import com.teamzemo.quasar.repository.SessionRepository;
import com.teamzemo.quasar.repository.SpeechMetricsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class SpeechController {

    private static final Logger log = LoggerFactory.getLogger(SpeechController.class);

    private final SpeechMetricsRepository speechMetricsRepository;
    private final SessionRepository sessionRepository;

    public SpeechController(SpeechMetricsRepository speechMetricsRepository,
                             SessionRepository sessionRepository) {
        this.speechMetricsRepository = speechMetricsRepository;
        this.sessionRepository       = sessionRepository;
    }

    /** POST /api/sessions/:sessionId/speech-metrics */
    @PostMapping("/sessions/{sessionId}/speech-metrics")
    public ResponseEntity<ApiResponse<SpeechMetrics>> saveSpeechMetrics(
            @PathVariable String sessionId,
            @RequestBody SpeechMetricsRequest req) {
        try {
            if (req.getTranscript() == null && req.getFillerBuckets() == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.fail("transcript or fillerBuckets required"));
            }

            Session session = sessionRepository.findById(sessionId).orElse(null);
            if (session == null) {
                return ResponseEntity.status(404).body(ApiResponse.fail("Session not found"));
            }

            SpeechMetrics sm = speechMetricsRepository.findBySessionId(sessionId)
                    .orElse(new SpeechMetrics());
            sm.setSessionId(sessionId);
            if (req.getTranscript()     != null) sm.setTranscript(req.getTranscript());
            if (req.getFillerBuckets()  != null) sm.setFillerBuckets(req.getFillerBuckets());
            if (req.getTotalFillers()   != null) sm.setTotalFillers(req.getTotalFillers());
            if (req.getWordsPerMinute() != null) sm.setWordsPerMinute(req.getWordsPerMinute());

            sm = speechMetricsRepository.save(sm);
            return ResponseEntity.ok(ApiResponse.ok("Speech metrics saved", sm));
        } catch (Exception e) {
            log.error("Save speech metrics error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to save speech metrics"));
        }
    }

    /** GET /api/sessions/:sessionId/speech-metrics */
    @GetMapping("/sessions/{sessionId}/speech-metrics")
    public ResponseEntity<ApiResponse<SpeechMetrics>> getSpeechMetrics(@PathVariable String sessionId) {
        try {
            SpeechMetrics sm = speechMetricsRepository.findBySessionId(sessionId).orElse(null);
            if (sm == null) {
                return ResponseEntity.status(404).body(ApiResponse.fail("Speech metrics not found"));
            }
            return ResponseEntity.ok(ApiResponse.ok("Speech metrics retrieved", sm));
        } catch (Exception e) {
            log.error("Get speech metrics error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to get speech metrics"));
        }
    }
}
