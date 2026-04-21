package com.example.tugaspaandi.model;

public record StoredCompression(
        String id,
        String originalFileName,
        String compressedFileName,
        byte[] compressedData,
        String contentType
) {
}
