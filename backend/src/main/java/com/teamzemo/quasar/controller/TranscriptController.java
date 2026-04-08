package com.teamzemo.quasar.controller;

import com.teamzemo.quasar.model.TranscriptRecord;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping("/api")
public class TranscriptController {

    // In-memory for now
    private final List<TranscriptRecord> transcripts = new CopyOnWriteArrayList<>();

    @PostMapping("/transcript")
    public ResponseEntity<Void> save(@RequestBody TranscriptRecord record) {
        record.setTimestamp(Instant.now());
        transcripts.add(record);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/transcripts")
    public ResponseEntity<List<TranscriptRecord>> getAll() {
        return ResponseEntity.ok(transcripts);
    }
}
