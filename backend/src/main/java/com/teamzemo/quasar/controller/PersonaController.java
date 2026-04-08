package com.teamzemo.quasar.controller;

import com.teamzemo.quasar.dto.ApiResponse;
import com.teamzemo.quasar.model.Persona;
import com.teamzemo.quasar.repository.PersonaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/personas")
public class PersonaController {

    private static final Logger log = LoggerFactory.getLogger(PersonaController.class);

    private final PersonaRepository personaRepository;

    public PersonaController(PersonaRepository personaRepository) {
        this.personaRepository = personaRepository;
    }

    /** GET /api/personas */
    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getPersonas() {
        try {
            List<Map<String, Object>> result = personaRepository.findAllByOrderByFollowUpAggressionAsc()
                    .stream()
                    .map(p -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("id",                  p.getId());
                        m.put("name",                p.getName());
                        m.put("description",         p.getDescription());
                        m.put("interruption_style",  p.getInterruptionStyle());
                        m.put("follow_up_aggression", p.getFollowUpAggression());
                        return m;
                    })
                    .collect(Collectors.toList());
            return ResponseEntity.ok(ApiResponse.ok("Personas retrieved", result));
        } catch (Exception e) {
            log.error("Get personas error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to get personas"));
        }
    }

    /** GET /api/personas/:id */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPersona(@PathVariable String id) {
        try {
            Persona persona = personaRepository.findById(id).orElse(null);
            if (persona == null) {
                return ResponseEntity.status(404).body(ApiResponse.fail("Persona not found"));
            }
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("id",                  persona.getId());
            data.put("name",                persona.getName());
            data.put("description",         persona.getDescription());
            data.put("system_prompt",       persona.getSystemPrompt());
            data.put("interruption_style",  persona.getInterruptionStyle());
            data.put("follow_up_aggression", persona.getFollowUpAggression());
            return ResponseEntity.ok(ApiResponse.ok("Persona retrieved", data));
        } catch (Exception e) {
            log.error("Get persona error", e);
            return ResponseEntity.internalServerError().body(ApiResponse.fail("Failed to get persona"));
        }
    }
}
