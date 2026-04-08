package com.teamzemo.quasar.repository;

import com.teamzemo.quasar.model.Persona;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PersonaRepository extends MongoRepository<Persona, String> {
    List<Persona> findAllByOrderByFollowUpAggressionAsc();
}
