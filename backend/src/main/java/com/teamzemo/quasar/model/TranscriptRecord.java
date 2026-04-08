package com.teamzemo.quasar.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public class TranscriptRecord {
    private String domain;
    private List<Map<String, String>> messages;
    private Instant timestamp;

    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }

    public List<Map<String, String>> getMessages() { return messages; }
    public void setMessages(List<Map<String, String>> messages) { this.messages = messages; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}
