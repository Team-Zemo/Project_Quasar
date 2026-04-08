package com.teamzemo.quasar.repository;

import com.teamzemo.quasar.model.SkillVector;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SkillVectorRepository extends MongoRepository<SkillVector, String> {
    List<SkillVector> findByUserIdOrderBySkillAsc(String userId);
    List<SkillVector> findByUserIdOrderByScoreAsc(String userId);
    Optional<SkillVector> findByUserIdAndSkill(String userId, String skill);
}
