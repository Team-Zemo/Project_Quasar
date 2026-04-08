package com.teamzemo.quasar.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Groq REST client.
 * Mirrors groqService.js — chatCompletion (blocking) + streamCompletion (SSE).
 * Uses the OpenAI-compatible Groq API via WebClient.
 */
@Service
public class GroqService {

    private static final Logger log = LoggerFactory.getLogger(GroqService.class);
    private static final String DEFAULT_MODEL = "llama-3.3-70b-versatile";

    private final WebClient webClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${groq.api-key}")
    private String apiKey;

    @Value("${groq.base-url}")
    private String baseUrl;

    public GroqService(WebClient webClient) {
        this.webClient = webClient;
    }

    /**
     * Blocking chat completion — returns raw text string.
     */
    @SuppressWarnings("unchecked")
    public String chatCompletion(String systemPrompt, String userPrompt,
                                  String model, double temperature, int maxTokens) {
        Map<String, Object> body = buildRequestBody(systemPrompt, userPrompt,
                model, temperature, maxTokens, false);
        try {
            Map<?, ?> response = webClient.post()
                    .uri(baseUrl + "/chat/completions")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null) return "";
            List<?> choices = (List<?>) response.get("choices");
            if (choices == null || choices.isEmpty()) return "";
            Map<?, ?> choice = (Map<?, ?>) choices.get(0);
            Map<?, ?> message = (Map<?, ?>) choice.get("message");
            return message != null ? String.valueOf(message.get("content")).trim() : "";

        } catch (Exception e) {
            log.error("Groq chatCompletion error: {}", e.getMessage());
            throw new RuntimeException("Groq API error: " + e.getMessage(), e);
        }
    }

    /** Convenience overload with defaults */
    public String chatCompletion(String systemPrompt, String userPrompt) {
        return chatCompletion(systemPrompt, userPrompt, DEFAULT_MODEL, 0.3, 4096);
    }

    /**
     * Streaming chat completion — returns a Flux<String> of raw SSE data lines.
     * Each line is either "data: {...}" or "data: [DONE]".
     */
    public Flux<String> streamCompletion(List<Map<String, String>> messages,
                                          String model, double temperature, int maxTokens) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", model != null ? model : DEFAULT_MODEL);
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);
        body.put("stream", true);
        body.put("messages", messages);

        return webClient.post()
                .uri(baseUrl + "/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToFlux(String.class)
                .filter(line -> !line.isBlank())
                .map(line -> {
                    // Groq SSE lines arrive as "data: {...}" — pass through as-is
                    if (line.startsWith("data:")) return line.substring(5).trim();
                    return line;
                });
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private Map<String, Object> buildRequestBody(String systemPrompt, String userPrompt,
                                                   String model, double temperature,
                                                   int maxTokens, boolean stream) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", model != null ? model : DEFAULT_MODEL);
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);
        body.put("stream", stream);
        body.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user",   "content", userPrompt)
        ));
        return body;
    }
}
