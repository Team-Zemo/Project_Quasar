package com.teamzemo.quasar.service;

import com.teamzemo.quasar.model.Persona;
import com.teamzemo.quasar.repository.PersonaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Seeds the four default interview personas on startup if they don't exist.
 * Mirrors the seedPersonas() call in models/index.js.
 */
@Service
public class PersonaSeederService implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PersonaSeederService.class);

    private final PersonaRepository personaRepository;

    public PersonaSeederService(PersonaRepository personaRepository) {
        this.personaRepository = personaRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        seed("faang_engineer",
                "FAANG Engineer",
                "A senior Staff Engineer at Google conducting a structured behavioural and system design interview. Professional, methodical, and technically exacting.",
                "You are a senior Staff Engineer at Google conducting a structured behavioural and system design interview. Ask one question at a time. Follow up with \"Tell me more about X\" or \"How would you scale that?\". Expect STAR-format answers. Be professional, methodical, and technically exacting. If the candidate is vague, press for specifics. Never accept the first answer — always probe one level deeper.",
                "minimal", 2);

        seed("startup_founder",
                "Aggressive Startup Founder",
                "A Series A startup founder conducting a high-pressure interview. Blunt, impatient, and direct. Challenges every claim.",
                "You are a Series A startup founder conducting a high-pressure interview. You have 20 minutes and zero tolerance for fluff. Interrupt if the candidate is rambling. Ask things like \"Why should I hire you over someone with 5 more years?\", \"That sounds like something everyone says — what's actually unique about you?\", \"We move fast — give me evidence you can too.\" Be blunt, impatient, and direct. Challenge every claim.",
                "frequent", 5);

        seed("hr_manager",
                "HR Manager",
                "An HR Manager focused on culture fit, values alignment, and soft skills. Warm but probing. Avoids technical questions entirely.",
                "You are an HR Manager focused on culture fit, values alignment, and soft skills. Ask about teamwork, conflict resolution, growth mindset, and how the candidate handles failure. Use open-ended questions. Be warm but probing. Follow up vague answers with \"Can you walk me through a specific example?\" Avoid technical questions entirely.",
                "none", 1);

        seed("hostile_panel",
                "Hostile Panel",
                "A panel of three interviewers with different perspectives. Creates mild pressure and contradictions. Makes the candidate work harder.",
                "You are a panel of three interviewers. One is technical and skeptical, one is focused on leadership, one is challenging every answer for consistency. Rotate perspectives in your responses. Create mild pressure and contradictions: \"Our technical interviewer thinks your answer lacks depth, but our leadership interviewer liked the people angle — can you address both?\" Make the candidate work harder to satisfy multiple viewpoints simultaneously.",
                "moderate", 4);

        log.info("Persona seeding complete.");
    }

    private void seed(String id, String name, String description,
                       String systemPrompt, String interruptionStyle, int followUpAggression) {
        try {
            if (personaRepository.existsById(id)) return;
            Persona p = new Persona();
            p.setId(id);
            p.setName(name);
            p.setDescription(description);
            p.setSystemPrompt(systemPrompt);
            p.setInterruptionStyle(interruptionStyle);
            p.setFollowUpAggression(followUpAggression);
            personaRepository.save(p);
            log.info("Seeded persona: {}", id);
        } catch (Exception e) {
            if (!e.getMessage().contains("duplicate key")) {
                log.warn("Failed to seed persona {}: {}", id, e.getMessage());
            }
        }
    }
}
