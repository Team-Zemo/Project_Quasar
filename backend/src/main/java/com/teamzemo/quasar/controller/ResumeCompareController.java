package com.teamzemo.quasar.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.teamzemo.quasar.dto.ApiResponse;
import com.teamzemo.quasar.service.GamificationService;
import com.teamzemo.quasar.service.GroqService;
import com.teamzemo.quasar.security.UserPrincipal;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@RestController
@RequestMapping("/api")
public class ResumeCompareController {

    private static final Logger log = LoggerFactory.getLogger(ResumeCompareController.class);

    private final GroqService         groqService;
    private final GamificationService gamificationService;
    private final ObjectMapper        objectMapper = new ObjectMapper();

    private static final String SYSTEM_PROMPT = """
            You are an expert ATS (Applicant Tracking System) and career coach.
            Analyse the provided RESUME against the JOB DESCRIPTION and return ONLY valid JSON (no markdown, no code fences) matching EXACTLY this schema:
            {
              "overallMatch": number,
              "verdict": "Strong Match" | "Good Match" | "Partial Match" | "Weak Match",
              "summary": string,
              "matchedSkills": [{ "skill": string, "proficiency": "expert" | "intermediate" | "beginner", "context": string }],
              "missingSkills": [{ "skill": string, "importance": "critical" | "important" | "nice-to-have", "suggestion": string }],
              "bonusSkills": [{ "skill": string, "relevance": string }],
              "experienceAnalysis": { "requiredYears": string, "candidateYears": string, "verdict": string },
              "educationAnalysis": { "required": string, "candidate": string, "verdict": string },
              "keyStrengths": string[],
              "improvementAreas": string[],
              "tailoringTips": string[]
            }""";

    public ResumeCompareController(GroqService groqService, GamificationService gamificationService) {
        this.groqService         = groqService;
        this.gamificationService = gamificationService;
    }

    /** POST /api/resume/compare  (multipart: resume PDF + jd PDF or jdText body param) */
    @PostMapping(value = "/resume/compare", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> compareResumeToJD(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestPart(value = "resume") MultipartFile resumeFile,
            @RequestPart(value = "jd", required = false) MultipartFile jdFile,
            @RequestParam(value = "jdText", required = false) String jdText) {

        try {
            if (resumeFile == null || resumeFile.isEmpty()) {
                return ResponseEntity.badRequest().body(ApiResponse.fail("Resume PDF is required"));
            }
            if (jdFile == null && (jdText == null || jdText.trim().length() < 50)) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.fail("Job description (PDF or at least 50 chars of text) is required"));
            }

            // Extract resume text
            String resumeText;
            try {
                resumeText = extractPDF(resumeFile.getBytes());
            } catch (Exception e) {
                return ResponseEntity.unprocessableEntity()
                        .body(ApiResponse.fail("Could not extract text from resume PDF: " + e.getMessage()));
            }
            if (resumeText == null || resumeText.length() < 30) {
                return ResponseEntity.unprocessableEntity()
                        .body(ApiResponse.fail("Resume PDF appears to be empty or image-only"));
            }

            // Extract JD text
            String jdContent = jdText != null ? jdText.trim() : "";
            String jdFileName = "Plain text input";
            if (jdFile != null && !jdFile.isEmpty()) {
                try {
                    jdContent  = extractPDF(jdFile.getBytes());
                    jdFileName = jdFile.getOriginalFilename();
                } catch (Exception e) {
                    return ResponseEntity.unprocessableEntity()
                            .body(ApiResponse.fail("Could not extract text from JD PDF: " + e.getMessage()));
                }
                if (jdContent == null || jdContent.length() < 30) {
                    return ResponseEntity.unprocessableEntity()
                            .body(ApiResponse.fail("JD PDF appears to be empty or image-only"));
                }
            }

            String userPrompt = "--- RESUME ---\n" + resumeText.substring(0, Math.min(6000, resumeText.length()))
                    + "\n\n--- JOB DESCRIPTION ---\n" + jdContent.substring(0, Math.min(4000, jdContent.length()));

            String responseText = groqService.chatCompletion(
                    SYSTEM_PROMPT, userPrompt, "llama-3.3-70b-versatile", 0.3, 4096);

            String clean = stripMarkdownFences(responseText);
            Map<String, Object> analysis = objectMapper.readValue(clean,
                    new TypeReference<Map<String, Object>>() {});

            // Gamification
            Map<String, Object> gamification = null;
            if (principal != null) {
                gamification = gamificationService.onResumeCompare(principal.getId());
            }

            Map<String, Object> data = new LinkedHashMap<>(analysis);
            data.put("resumeFileName", resumeFile.getOriginalFilename());
            data.put("jdFileName",     jdFileName);
            data.put("newBadge",       gamification != null ? gamification.get("newBadge") : null);

            return ResponseEntity.ok(ApiResponse.ok("Resume vs JD comparison complete", data));

        } catch (Exception e) {
            log.error("Resume compare error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to compare resume and JD"));
        }
    }

    private String extractPDF(byte[] bytes) throws Exception {
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            return new PDFTextStripper().getText(doc);
        }
    }

    private String stripMarkdownFences(String text) {
        text = text.trim();
        if (text.startsWith("```")) {
            text = text.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("```\\s*$", "").trim();
        }
        return text;
    }
}
