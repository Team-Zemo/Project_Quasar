package com.teamzemo.quasar.service;

import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.Map;

/**
 * Generates Gemini Live API ephemeral tokens.
 * Kept and improved from the existing Spring Boot reference implementation.
 * Used by the frontend for client-side Live API connections.
 */
@Service
public class EphemeralTokenService {

    private static final Logger log = LoggerFactory.getLogger(EphemeralTokenService.class);

    @Value("${gemini.api-key}")
    private String apiKey;

    @Value("${gemini.token-url}")
    private String tokenUrl;

    private final WebClient webClient;

    public EphemeralTokenService(WebClient webClient) {
        this.webClient = webClient;
    }

    /**
     * Request an ephemeral token from the Gemini auth_tokens API.
     * The token is valid for 30 minutes and can be used once to start a Live session.
     *
     * @param domain           The interview domain (sanitized by caller)
     * @param customSystemPrompt Optional system prompt override (from persona or JD)
     * @return The ephemeral token string (resource name like "auth_tokens/xyz")
     */
    @SuppressWarnings("unchecked")
    public String getEphemeralToken(String domain, String customSystemPrompt) {
        String requestJson = """
                {
                  "expireTime": "%s",
                  "newSessionExpireTime": "%s",
                  "uses": 1
                }
                """.formatted(
                Instant.now().plusSeconds(1800).toString(),   // 30 mins total
                Instant.now().plusSeconds(60).toString()      // 1 min to create session
        );

        try {
            log.info("Requesting Gemini ephemeral token for domain: {}", domain);

            Map<?, ?> response = webClient.post()
                    .uri(tokenUrl + "?key=" + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestJson)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null) {
                throw new RuntimeException("Gemini API returned null response");
            }

            // Token is in the 'name' field: "auth_tokens/xyz"
            Object tokenObj = response.get("name");
            if (tokenObj == null) tokenObj = response.get("token");
            if (tokenObj == null) {
                throw new RuntimeException("No token found in Gemini response. Keys: " + response.keySet());
            }

            String token = tokenObj.toString();
            log.info("Ephemeral token obtained: {}...", token.substring(0, Math.min(40, token.length())));
            return token;

        } catch (WebClientResponseException e) {
            log.error("Gemini API error {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new RuntimeException("Gemini API error: " + e.getResponseBodyAsString(), e);
        }
    }

    /** Overload for cases without a custom system prompt */
    public String getEphemeralToken(String domain) {
        return getEphemeralToken(domain, null);
    }
}
