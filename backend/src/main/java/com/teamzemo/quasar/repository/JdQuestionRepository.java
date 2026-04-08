package com.teamzemo.quasar.repository;

import com.teamzemo.quasar.model.JdQuestion;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface JdQuestionRepository extends MongoRepository<JdQuestion, String> {
    List<JdQuestion> findByJdSessionIdOrderByWeightDesc(String jdSessionId);
    List<JdQuestion> findByJdSessionIdInOrderByWeightDesc(List<String> jdSessionIds);
}
