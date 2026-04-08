package com.teamzemo.quasar.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.teamzemo.quasar.dto.CoachChatRequest;
import com.teamzemo.quasar.model.Session;
import com.teamzemo.quasar.model.SkillVector;
import com.teamzemo.quasar.model.UserStats;
import com.teamzemo.quasar.repository.SessionRepository;
import com.teamzemo.quasar.repository.SkillVectorRepository;
import com.teamzemo.quasar.repository.UserStatsRepository;
import com.teamzemo.quasar.security.UserPrincipal;
import com.teamzemo.quasar.service.GroqService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class CoachController {

    private static final Logger log = LoggerFactory.getLogger(CoachController.class);

    private final GroqService           groqService;
    private final SessionRepository     sessionRepository;
    private final UserStatsRepository   userStatsRepository;
    private final SkillVectorRepository skillVectorRepository;
    private final ObjectMapper          objectMapper = new ObjectMapper();

    private static final String SYSTEM_PROMPT =
            "You are **Quasar Coach**, an expert AI career coach. Help with interview prep, " +
            "time management, course planning, and career advice. Use markdown formatting. " +
            "Never write code or help with non-career topics. Be specific and actionable.";

    public CoachController(GroqService groqService, SessionRepository sessionRepository,
                            UserStatsRepository userStatsRepository,
                            SkillVectorRepository skillVectorRepository) {
        this.groqService           = groqService;
        this.sessionRepository     = sessionRepository;
        this.userStatsRepository   = userStatsRepository;
        this.skillVectorRepository = skillVectorRepository;
    }

    /** POST /api/coach/chat — SSE streaming */
    @PostMapping(value = "/coach/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<StreamingResponseBody> chat(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody CoachChatRequest req) {

        List<Map<String, String>> messages = req.getMessages();
        if (messages == null || messages.isEmpty()) return ResponseEntity.badRequest().build();

        List<Map<String, String>> sanitized = messages.stream()
                .filter(m -> "user".equals(m.get("role")) || "assistant".equals(m.get("role")))
                .map(m -> Map.of("role", m.get("role"),
                        "content", String.valueOf(m.get("content"))
                                .substring(0, Math.min(4000, String.valueOf(m.get("content")).length()))))
                .collect(Collectors.toList());

        if (sanitized.isEmpty() || !"user".equals(sanitized.get(sanitized.size() - 1).get("role")))
            return ResponseEntity.badRequest().build();

        String userContext = buildUserContext(principal.getId());
        String fullSystem  = SYSTEM_PROMPT + (userContext.isBlank() ? "" : "\n\n" + userContext);

        List<Map<String, String>> allMessages = new ArrayList<>();
        allMessages.add(Map.of("role", "system", "content", fullSystem));
        allMessages.addAll(sanitized);

        StreamingResponseBody body = out -> streamGroqToSSE(out, allMessages);

        return ResponseEntity.ok()
                .header("Cache-Control", "no-cache")
                .header("Connection", "keep-alive")
                .header("X-Accel-Buffering", "no")
                .body(body);
    }

    private void streamGroqToSSE(OutputStream out, List<Map<String, String>> messages) {
        try {
            groqService.streamCompletion(messages, "llama-3.3-70b-versatile", 0.5, 4096)
                    .doOnNext(chunk -> {
                        if (chunk == null || chunk.equals("[DONE]")) return;
                        try {
                            @SuppressWarnings("unchecked")
                            Map<?, ?> parsed = objectMapper.readValue(chunk, Map.class);
                            @SuppressWarnings("unchecked")
                            List<?> choices = (List<?>) parsed.get("choices");
                            if (choices != null && !choices.isEmpty()) {
                                @SuppressWarnings("unchecked")
                                Map<?, ?> delta = (Map<?, ?>) ((Map<?, ?>) choices.get(0)).get("delta");
                                if (delta != null && delta.get("content") != null) {
                                    String sse = "data: " + objectMapper.writeValueAsString(
                                            Map.of("content", delta.get("content"))) + "\n\n";
                                    out.write(sse.getBytes(StandardCharsets.UTF_8));
                                    out.flush();
                                }
                            }
                        } catch (Exception ignored) {}
                    })
                    .doOnComplete(() -> {
                        try {
                            out.write("data: [DONE]\n\n".getBytes(StandardCharsets.UTF_8));
                            out.flush();
                        } catch (Exception ignored) {}
                    })
                    .blockLast();
        } catch (Exception e) {
            log.error("Coach stream error: {}", e.getMessage());
        }
    }

    private String buildUserContext(String userId) {
        try {
            List<Session> sessions = sessionRepository.findByUserId(userId).stream()
                    .filter(s -> s.getOverallScore() != null)
                    .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                    .limit(10).collect(Collectors.toList());

            UserStats stats = userStatsRepository.findByUserId(userId).orElse(null);
            List<SkillVector> skillVectors = skillVectorRepository.findByUserIdOrderByScoreAsc(userId);

            if (sessions.isEmpty() && stats == null) return "";

            List<String> parts = new ArrayList<>();
            parts.add("\n## USER CONTEXT\n");

            if (stats != null) {
                parts.add("- Level: " + stats.getLevel() + " | XP: " + stats.getXp());
                parts.add("- Total sessions: " + stats.getTotalSessions());
                parts.add("- Streak: " + stats.getCurrentStreak() + " days");
            }

            if (!sessions.isEmpty()) {
                double avg = sessions.stream().mapToDouble(Session::getOverallScore).average().orElse(0);
                parts.add("- Avg score: " + Math.round(avg * 10.0) / 10.0 + "/10");
            }

            skillVectors.forEach(sv ->
                    parts.add("- Skill " + sv.getSkill() + ": " + sv.getScore() + "/10"));

            return String.join("\n", parts);
        } catch (Exception e) {
            return "";
        }
    }
}
