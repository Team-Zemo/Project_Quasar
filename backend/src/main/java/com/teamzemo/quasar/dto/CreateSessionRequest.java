package com.teamzemo.quasar.dto;

public class CreateSessionRequest {
    private String domain;
    private String personaId;
    private String jdSessionId;

    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }
    public String getPersonaId() { return personaId; }
    public void setPersonaId(String personaId) { this.personaId = personaId; }
    public String getJdSessionId() { return jdSessionId; }
    public void setJdSessionId(String jdSessionId) { this.jdSessionId = jdSessionId; }
}
