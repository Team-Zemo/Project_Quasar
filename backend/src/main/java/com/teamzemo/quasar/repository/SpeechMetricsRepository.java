package com.teamzemo.quasar.repository;

import com.teamzemo.quasar.model.SpeechMetrics;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SpeechMetricsRepository extends MongoRepository<SpeechMetrics, String> {
    Optional<SpeechMetrics> findBySessionId(String sessionId);
    List<SpeechMetrics> findBySessionIdIn(List<String> sessionIds);
}
