package com.teamzemo.quasar.controller;

import com.teamzemo.quasar.dto.ApiResponse;
import com.teamzemo.quasar.model.*;
import com.teamzemo.quasar.repository.*;
import com.teamzemo.quasar.security.UserPrincipal;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api")
public class ReportController {

    private static final Logger log = LoggerFactory.getLogger(ReportController.class);

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm").withZone(ZoneId.of("UTC"));

    private final SessionRepository       sessionRepository;
    private final SpeechMetricsRepository speechMetricsRepository;
    private final UserRepository          userRepository;
    private final UserStatsRepository     userStatsRepository;
    private final SkillVectorRepository   skillVectorRepository;

    public ReportController(SessionRepository sessionRepository,
                             SpeechMetricsRepository speechMetricsRepository,
                             UserRepository userRepository,
                             UserStatsRepository userStatsRepository,
                             SkillVectorRepository skillVectorRepository) {
        this.sessionRepository       = sessionRepository;
        this.speechMetricsRepository  = speechMetricsRepository;
        this.userRepository           = userRepository;
        this.userStatsRepository      = userStatsRepository;
        this.skillVectorRepository    = skillVectorRepository;
    }

    /** GET /api/sessions/:sessionId/report — returns PDF bytes */
    @GetMapping("/sessions/{sessionId}/report")
    public ResponseEntity<?> generateReport(
            @PathVariable String sessionId,
            @AuthenticationPrincipal UserPrincipal principal) {
        try {
            Session session = sessionRepository.findById(sessionId).orElse(null);
            if (session == null) {
                return ResponseEntity.status(404)
                        .body(ApiResponse.fail("Session not found"));
            }
            if (!principal.getId().equals(session.getUserId())) {
                return ResponseEntity.status(403).body(ApiResponse.fail("Forbidden"));
            }
            if (!"completed".equals(session.getStatus())) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.fail("Session must be completed before generating a report"));
            }

            User user = userRepository.findById(principal.getId()).orElse(null);
            String userName = user != null ? user.getName() : "User";

            SpeechMetrics speech = speechMetricsRepository.findBySessionId(sessionId).orElse(null);
            UserStats stats      = userStatsRepository.findByUserId(principal.getId()).orElse(null);
            List<SkillVector> skills = skillVectorRepository.findByUserIdOrderBySkillAsc(principal.getId());

            byte[] pdfBytes = buildPDF(session, speech, userName, stats, skills);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDisposition(ContentDisposition.attachment()
                    .filename("quasar-report-" + sessionId + ".pdf").build());
            headers.setContentLength(pdfBytes.length);

            return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);

        } catch (Exception e) {
            log.error("Report generation error", e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.fail("Failed to generate report"));
        }
    }

    // ── PDF Builder ───────────────────────────────────────────────────

    private byte[] buildPDF(Session session, SpeechMetrics speech,
                              String userName, UserStats stats,
                              List<SkillVector> skills) throws Exception {

        try (PDDocument doc = new PDDocument()) {

            PDType1Font BOLD   = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font NORMAL = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

            float margin = 50;
            float width  = PDRectangle.A4.getWidth();
            float height = PDRectangle.A4.getHeight();

            // ── Page 1 ────────────────────────────────────────────────
            PDPage page1 = new PDPage(PDRectangle.A4);
            doc.addPage(page1);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page1)) {
                // Header bar
                cs.setNonStrokingColor(0.24f, 0.15f, 0.60f); // indigo
                cs.addRect(0, height - 80, width, 80);
                cs.fill();

                // Title
                cs.beginText();
                cs.setFont(BOLD, 22);
                cs.setNonStrokingColor(1f, 1f, 1f);
                cs.newLineAtOffset(margin, height - 50);
                cs.showText("Interview Quasar — Session Report");
                cs.endText();

                cs.beginText();
                cs.setFont(NORMAL, 11);
                cs.setNonStrokingColor(0.8f, 0.8f, 0.9f);
                cs.newLineAtOffset(margin, height - 68);
                cs.showText("Generated " + DATE_FMT.format(java.time.Instant.now()));
                cs.endText();

                // Candidate info block
                float y = height - 110;
                cs.setNonStrokingColor(0f, 0f, 0f);

                y = writeLine(cs, BOLD, 13, margin, y, "Candidate: " + userName);
                y = writeLine(cs, NORMAL, 11, margin, y - 4,
                        "Domain: " + (session.getDomain() != null ? session.getDomain() : "General"));
                y = writeLine(cs, NORMAL, 11, margin, y - 4,
                        "Session Date: " + (session.getStartedAt() != null ? DATE_FMT.format(session.getStartedAt()) : "—"));

                int dur = session.getDurationSeconds() != null ? session.getDurationSeconds() : 0;
                y = writeLine(cs, NORMAL, 11, margin, y - 4,
                        "Duration: " + (dur / 60) + " min " + (dur % 60) + " sec");

                // Divider
                y -= 14;
                cs.setStrokingColor(0.7f, 0.7f, 0.9f);
                cs.setLineWidth(1);
                cs.moveTo(margin, y);
                cs.lineTo(width - margin, y);
                cs.stroke();
                y -= 16;

                // Overall score
                double overall = session.getOverallScore() != null ? session.getOverallScore() : 0;
                y = writeLine(cs, BOLD, 15, margin, y, "Overall Score: " + overall + " / 10"
                        + (overall >= 6.5 ? "  ✓ PASS" : "  ✗ BELOW PASS"));

                if (session.getClarityScore() != null) {
                    y = writeLine(cs, NORMAL, 11, margin, y - 6,
                            "Clarity Score: " + session.getClarityScore() + " / 10");
                }

                // STAR scores
                if (session.getStarScores() != null && !session.getStarScores().isEmpty()) {
                    y -= 16;
                    y = writeLine(cs, BOLD, 13, margin, y, "STAR Dimension Scores");
                    y -= 6;
                    for (Map.Entry<String, Object> e : session.getStarScores().entrySet()) {
                        double v = toDouble(e.getValue());
                        y = writeLine(cs, NORMAL, 11, margin + 16, y - 4,
                                capitalize(e.getKey()) + ": " + v + " / 10  " + scoreBar(v));
                    }
                }

                // Speech metrics
                if (speech != null) {
                    y -= 14;
                    y = writeLine(cs, BOLD, 13, margin, y, "Speech Analytics");
                    y -= 6;
                    y = writeLine(cs, NORMAL, 11, margin + 16, y - 4,
                            "Filler words: " + (speech.getTotalFillers() != null ? speech.getTotalFillers() : 0));
                    if (speech.getWordsPerMinute() != null && speech.getWordsPerMinute() > 0) {
                        y = writeLine(cs, NORMAL, 11, margin + 16, y - 4,
                                "Words per minute: " + Math.round(speech.getWordsPerMinute()));
                    }
                }

                // Skill vectors
                if (!skills.isEmpty()) {
                    y -= 14;
                    y = writeLine(cs, BOLD, 13, margin, y, "Skill Profile");
                    y -= 6;
                    for (SkillVector sv : skills) {
                        if (y < 80) break;
                        y = writeLine(cs, NORMAL, 11, margin + 16, y - 4,
                                sv.getSkill().replace("_", " ") + ": " + sv.getScore() + " / 10  " + scoreBar(sv.getScore()));
                    }
                }
            }

            // ── Page 2 — Transcript ───────────────────────────────────
            if (session.getTranscript() != null && !session.getTranscript().isBlank()) {
                PDPage page2 = new PDPage(PDRectangle.A4);
                doc.addPage(page2);
                try (PDPageContentStream cs = new PDPageContentStream(doc, page2)) {
                    float y = height - margin;
                    y = writeLine(cs, BOLD, 15, margin, y, "Interview Transcript");
                    y -= 10;
                    cs.setStrokingColor(0.7f, 0.7f, 0.9f);
                    cs.moveTo(margin, y);
                    cs.lineTo(width - margin, y);
                    cs.stroke();
                    y -= 14;

                    String transcript = session.getTranscript();
                    if (transcript.length() > 5000) transcript = transcript.substring(0, 5000) + "\n[Truncated...]";
                    String[] lines = transcript.split("\n");
                    for (String line : lines) {
                        if (y < 60) break;
                        // Word-wrap
                        String remaining = line;
                        while (!remaining.isBlank()) {
                            int clip = Math.min(remaining.length(), 110);
                            String segment = remaining.substring(0, clip);
                            y = writeLine(cs, NORMAL, 9, margin, y - 2, segment);
                            remaining = remaining.substring(clip).trim();
                        }
                    }
                }
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();
        }
    }

    // ── Utilities ─────────────────────────────────────────────────────

    private float writeLine(PDPageContentStream cs, PDType1Font font, float size,
                             float x, float y, String text) throws Exception {
        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y);
        // Safe text — strip characters outside Latin-1
        String safe = text.chars()
                .filter(c -> c < 256)
                .collect(StringBuilder::new, (sb, c) -> sb.append((char) c), StringBuilder::append)
                .toString();
        cs.showText(safe);
        cs.endText();
        return y - size - 2;
    }

    private String scoreBar(double score) {
        int filled = (int) Math.round(score);
        return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, 10 - filled));
    }

    private double toDouble(Object o) {
        if (o == null) return 0.0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(o.toString()); } catch (Exception e) { return 0.0; }
    }

    private String capitalize(String s) {
        if (s == null || s.isBlank()) return "";
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
