package com.teamzemo.quasar.repository;

import com.teamzemo.quasar.model.Session;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SessionRepository extends MongoRepository<Session, String> {
    List<Session> findByUserIdOrderByCreatedAtDesc(String userId);
    List<Session> findByUserIdAndStatusOrderByStartedAtAsc(String userId, String status);
    long countByUserIdAndStatus(String userId, String status);
    List<Session> findByUserId(String userId);
}
