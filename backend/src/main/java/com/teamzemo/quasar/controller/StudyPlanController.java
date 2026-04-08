package com.teamzemo.quasar.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.teamzemo.quasar.dto.StudyPlanRequest;
import com.teamzemo.quasar.security.UserPrincipal;
import com.teamzemo.quasar.service.GroqService;
import jakarta.validation.Valid;
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
public class StudyPlanController {

    private static final Logger log = LoggerFactory.getLogger(StudyPlanController.class);

    private final GroqService    groqService;
    private final ObjectMapper   objectMapper = new ObjectMapper();

    private static final String SYSTEM_PROMPT =
        "You are an expert learning architect and curriculum designer. " +
        "Your job is to create precise, actionable, week-by-week study plans.\n\n" +
        "## Output Rules — STRICT\n" +
        "- Output ONLY valid Markdown. No preamble, no meta-commentary.\n" +
        "- Begin IMMEDIATELY with \"# [Skill] Study Plan — [N]-Week Roadmap\" as the first line.\n" +
        "- Structure every plan with: Overview, Learning Path, Week-by-week breakdown with Goals, " +
        "Topics, Daily Breakdown table, Milestone Checklist, then Recommended Resources and Tips.\n" +
        "- Use real, widely-known resources (MDN, official docs, freeCodeCamp, roadmap.sh, etc.).\n" +
        "- Be specific: name actual concepts, not vague \"learn X basics\".";

    public StudyPlanController(GroqService groqService) {
        this.groqService = groqService;
    }

    /** POST /api/study-plan/generate — SSE streaming */
    @PostMapping(value = "/study-plan/generate", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<StreamingResponseBody> generatePlan(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody StudyPlanRequest req) {

        String stackStr = req.getTechStack().stream()
                .map(String::trim).filter(s -> !s.isBlank()).collect(Collectors.joining(", "));
        String levelStr = req.getCurrentLevel() != null ? req.getCurrentLevel() : "Not specified";
        String hoursStr = req.getDailyHours()   != null ? req.getDailyHours() + " hours/day" : "Not specified";
        String goalsStr = req.getGoals()         != null && !req.getGoals().isBlank()
                ? req.getGoals().trim() : "None provided";

        String userPrompt = "Generate a " + req.getWeeks() + "-week study plan with the following parameters:\n\n" +
                "**Skill to Learn:** " + req.getSkillToLearn().trim() + "\n" +
                "**Tech Stack / Tools:** " + stackStr + "\n" +
                "**Current Level:** " + levelStr + "\n" +
                "**Daily Study Time Available:** " + hoursStr + "\n" +
                "**Additional Goals / Context:** " + goalsStr + "\n\n" +
                "Create a complete, detailed plan covering all " + req.getWeeks() + " weeks. " +
                (req.getWeeks() <= 4 ? "Be very granular with daily topics since the timeline is short." : "") +
                (req.getWeeks() >= 8 ? "Structure in phases: Foundations, Core, Advanced, Project Work." : "") +
                "\nMake resource links real and specific to \"" + stackStr + "\".";

        log.info("Study plan generation started userId={} skill={} weeks={}",
                principal.getId(), req.getSkillToLearn(), req.getWeeks());

        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", SYSTEM_PROMPT),
                Map.of("role", "user",   "content", userPrompt)
        );

        StreamingResponseBody body = out -> streamToSSE(out, messages);

        return ResponseEntity.ok()
                .header("Cache-Control", "no-cache")
                .header("Connection", "keep-alive")
                .header("X-Accel-Buffering", "no")
                .body(body);
    }

    private void streamToSSE(OutputStream out, List<Map<String, String>> messages) {
        try {
            groqService.streamCompletion(messages, "llama-3.3-70b-versatile", 0.4, 8192)
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
            log.error("Study plan stream error: {}", e.getMessage());
        }
    }
}
