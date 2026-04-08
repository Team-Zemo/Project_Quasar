package com.teamzemo.quasar.repository;

import com.teamzemo.quasar.model.RefreshToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface RefreshTokenRepository extends MongoRepository<RefreshToken, String> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);
    Optional<RefreshToken> findByTokenHashAndUserId(String tokenHash, String userId);
    void deleteAllByUserId(String userId);
}
