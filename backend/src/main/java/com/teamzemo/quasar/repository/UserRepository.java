package com.teamzemo.quasar.repository;

import com.teamzemo.quasar.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);
    Optional<User> findByGoogleId(String googleId);
    Optional<User> findByGithubId(String githubId);
    boolean existsByEmail(String email);
}
