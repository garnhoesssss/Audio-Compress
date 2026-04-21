package com.example.tugaspaandi.service;

import com.example.tugaspaandi.model.StoredCompression;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class CompressionStore {

    private final Map<String, StoredCompression> storage = new ConcurrentHashMap<>();

    public void put(StoredCompression storedCompression) {
        storage.put(storedCompression.id(), storedCompression);
    }

    public Optional<StoredCompression> get(String id) {
        return Optional.ofNullable(storage.get(id));
    }
}
