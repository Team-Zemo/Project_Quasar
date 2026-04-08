package com.teamzemo.quasar.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.teamzemo.quasar.dto.ApiResponse;
import com.teamzemo.quasar.model.JdQuestion;
import com.teamzemo.quasar.model.JdSession;
import com.teamzemo.quasar.repository.JdQuestionRepository;
import com.teamzemo.quasar.repository.JdSessionRepository;
import com.teamzemo.quasar.security.UserPrincipal;
import com.teamzemo.quasar.service.GamificationService;
import com.teamzemo.quasar.service.GroqService;
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

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class JdController {

    private static final Logger log = LoggerFactory.getLogger(JdController.class);

    private final JdSessionRepository  jdSessionRepository;
    private final JdQuestionRepository jdQuestionRepository;
    private final GroqService            groqService;
    private final GamificationService    gamificationService;
    private final ObjectMapper           objectMapper = new ObjectMapper();

    private static final String SYSTEM_PROMPT = """
            You are an expert technical recruiter. Analyse the provided job description and return ONLY valid JSON (no markdown, no code fences) matching this exact schema:
            {
              "role": string,
              "seniority": "junior" | "mid" | "senior" | "staff" | "principal",
              "domain": string,
              "requiredSkills": string[],
              "niceToHaveSkills": string[],
              "culturalSignals": string[],
              "generatedQuestions": [
                {
                  "question": string,
                  "category": "behavioural" | "technical" | "system-design" | "culture-fit",
                  "difficulty": 1 | 2 | 3,
                  "targetSkill": string,
                  "weight": number
                }
              ]
            }
            Generate exactly 20 questions, weighted by importance to the role. Weight values should be between 0.0 and 1.0, higher = more important.""";

    public JdController(JdSessionRepository jdSessionRepository,
                        JdQuestionRepository jdQuestionRepository,
                        GroqService groqService,
                        GamificationService gamificationService) {
        this.jdSessionRepository  = jdSessionRepository;
        this.jdQuestionRepository = jdQuestionRepository;
        this.groqService           = groqService;
        this.gamificationService   = gamificationService;
    }

    /** POST /api/jd/parse  (multipart PDF or JSON body) */
    @PostMapping(value = "/jd/parse", consumes = {MediaType.MULTIPART_FORM_DATA_VALUE,
                                                    MediaType.APPLICATION_JSON_VALUE,
                                                    MediaType.APPLICATION_OCTET_STREAM_VALUE,
                                                    "*/*"})
    public ResponseEntity<ApiResponse<Map<String, Object>>> parseJD(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(value = "jd", required = false) MultipartFile jdFile,
            @RequestParam(value = "jobDescription", required = false) String jobDescriptionParam,
            @RequestBody(required = false) Map<String, Object> jsonBody) {

        try {
            String userId = principal != null ? principal.getId() : null;
            String jobDescription = "";

            if (jdFile != null && !jdFile.isEmpty()) {
                try {
                    jobDescription = extractTextFromPDF(jdFile.getBytes());
                } catch (Exception e) {
                    return ResponseEntity.unprocessableEntity()
                            .body(ApiResponse.fail("Could not extract text from JD PDF: " + e.getMessage()));
                }
            } else if (jobDescriptionParam != null) {
                jobDescription = jobDescriptionParam.trim();
            } else if (jsonBody != null && jsonBody.get("jobDescription") != null) {
                jobDescription = String.valueOf(jsonBody.get("jobDescription")).trim();
            }

            if (jobDescription.length() < 50) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.fail("Job description must be at least 50 characters"));
            }

            String responseText = groqService.chatCompletion(
                    SYSTEM_PROMPT,
                    "Job Description:\n" + jobDescription,
                    "llama-3.3-70b-versatile", 0.4, 4096);

            String clean = stripMarkdownFences(responseText);
            Map<String, Object> parsedData = objectMapper.readValue(clean,
                    new TypeReference<Map<String, Object>>() {});

            JdSession jdSession = new JdSession();
            jdSession.setUserId(userId);
            jdSession.setJobDescription(jobDescription);
            jdSession.setParsedData(parsedData);
            jdSession = jdSessionRepository.save(jdSession);

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> generatedQs =
                    (List<Map<String, Object>>) parsedData.get("generatedQuestions");
            if (generatedQs != null) {
                final String jdSessionId = jdSession.getId();
                List<JdQuestion> questions = generatedQs.stream().map(q -> {
                    JdQuestion jq = new JdQuestion();
                    jq.setJdSessionId(jdSessionId);
                    jq.setQuestion(String.valueOf(q.get("question")));
                    jq.setCategory(String.valueOf(q.getOrDefault("category", "")));
                    Object diff = q.get("difficulty");
                    jq.setDifficulty(diff instanceof Number n ? n.intValue() : 1);
                    jq.setTargetSkill(String.valueOf(q.getOrDefault("targetSkill", "")));
                    Object w = q.get("weight");
                    jq.setWeight(w instanceof Number n ? n.doubleValue() : 0.5);
                    return jq;
                }).collect(Collectors.toList());
                jdQuestionRepository.saveAll(questions);
            }

            if (userId != null) {
                new Thread(() -> gamificationService.onJDParsed(userId)).start();
            }

            Map<String, Object> data = new LinkedHashMap<>();
            data.put("jdSessionId",      jdSession.getId());
            data.put("role",             parsedData.get("role"));
            data.put("seniority",        parsedData.get("seniority"));
            data.put("domain",           parsedData.get("domain"));
            data.put("requiredSkills",   parsedData.get("requiredSkills"));
            data.put("niceToHaveSkills", parsedData.get("niceToHaveSkills"));
            data.put("culturalSignals",  parsedData.get("culturalSignals"));
            data.put("questions",        generatedQs);

            return ResponseEntity.ok(ApiResponse.ok("Job description parsed successfully", data));

        } catch (Exception e) {
            log.error("Parse JD error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to parse job description"));
        }
    }

    /** GET /api/jd/:jdSessionId/questions */
    @GetMapping("/jd/{jdSessionId}/questions")
    public ResponseEntity<ApiResponse<List<JdQuestion>>> getJDQuestions(@PathVariable String jdSessionId) {
        try {
            List<JdQuestion> questions = jdQuestionRepository
                    .findByJdSessionIdOrderByWeightDesc(jdSessionId);
            return ResponseEntity.ok(ApiResponse.ok("Questions retrieved", questions));
        } catch (Exception e) {
            log.error("Get JD questions error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to get questions"));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────

    public static String extractTextFromPDF(byte[] bytes) throws IOException {
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            return new PDFTextStripper().getText(doc);
        }
    }

    static String stripMarkdownFences(String text) {
        text = text.trim();
        if (text.startsWith("```")) {
            text = text.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("```\\s*$", "").trim();
        }
        return text;
    }
}
