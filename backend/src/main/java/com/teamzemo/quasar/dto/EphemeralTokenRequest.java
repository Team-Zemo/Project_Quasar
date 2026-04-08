package com.teamzemo.quasar.dto;

public class EphemeralTokenRequest {
    private String domain;
    private String personaId;
    private String customSystemPrompt;

    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }
    public String getPersonaId() { return personaId; }
    public void setPersonaId(String personaId) { this.personaId = personaId; }
    public String getCustomSystemPrompt() { return customSystemPrompt; }
    public void setCustomSystemPrompt(String customSystemPrompt) { this.customSystemPrompt = customSystemPrompt; }
}
