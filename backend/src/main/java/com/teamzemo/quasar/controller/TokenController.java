package com.teamzemo.quasar.controller;

import com.teamzemo.quasar.dto.ApiResponse;
import com.teamzemo.quasar.dto.EphemeralTokenRequest;
import com.teamzemo.quasar.model.Persona;
import com.teamzemo.quasar.repository.PersonaRepository;
import com.teamzemo.quasar.security.UserPrincipal;
import com.teamzemo.quasar.service.EphemeralTokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Ephemeral token endpoint.
 * POST /api/session/token
 *
 * Kept from the existing Spring Boot implementation and extended to support
 * persona lookup + custom system prompt injection.
 */
@RestController
@RequestMapping("/api")
public class TokenController {

    private static final Logger log = LoggerFactory.getLogger(TokenController.class);

    private final EphemeralTokenService tokenService;
    private final PersonaRepository personaRepository;

    public TokenController(EphemeralTokenService tokenService,
                           PersonaRepository personaRepository) {
        this.tokenService       = tokenService;
        this.personaRepository  = personaRepository;
    }

    @PostMapping("/session/token")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getToken(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody EphemeralTokenRequest body) {

        String domain = body.getDomain();
        if (domain == null || domain.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.fail("domain is required"));
        }

        // Sanitise domain to prevent prompt injection
        domain = domain.replaceAll("[^a-zA-Z0-9 ]", "").trim();
        if (domain.length() > 50) {
            return ResponseEntity.badRequest().body(ApiResponse.fail("domain is too long"));
        }

        // Resolve custom system prompt: persona takes priority, then explicit customSystemPrompt
        String customSystemPrompt = body.getCustomSystemPrompt();
        if (body.getPersonaId() != null && !body.getPersonaId().isBlank()) {
            try {
                Persona persona = personaRepository.findById(body.getPersonaId()).orElse(null);
                if (persona != null) {
                    customSystemPrompt = persona.getSystemPrompt();
                    log.info("Using persona system prompt for {}", body.getPersonaId());
                }
            } catch (Exception e) {
                log.warn("Failed to fetch persona {}: {}", body.getPersonaId(), e.getMessage());
            }
        }

        try {
            String token = tokenService.getEphemeralToken(domain, customSystemPrompt);
            if (token == null || token.isBlank()) {
                return ResponseEntity.internalServerError()
                        .body(ApiResponse.fail("Failed to obtain ephemeral token"));
            }
            return ResponseEntity.ok(ApiResponse.ok("Ephemeral token issued",
                    Map.of("token", token, "domain", domain,
                           "systemPrompt", customSystemPrompt != null ? customSystemPrompt : "")));
        } catch (Exception e) {
            log.error("Token generation failed: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.fail("Token generation failed: " + e.getMessage()));
        }
    }
}
