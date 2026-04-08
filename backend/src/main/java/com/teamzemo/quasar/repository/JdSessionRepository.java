package com.teamzemo.quasar.repository;

import com.teamzemo.quasar.model.JdSession;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface JdSessionRepository extends MongoRepository<JdSession, String> {
    List<JdSession> findByUserId(String userId);
}
