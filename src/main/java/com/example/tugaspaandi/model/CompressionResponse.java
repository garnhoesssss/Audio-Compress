package com.example.tugaspaandi.model;

public record CompressionResponse(
        String id,
        String fileName,
        double originalSizeMb,
        double compressedSizeMb,
        long originalBits,
        long compressedBits,
        double rc,
        double cr,
        double rd,
        String downloadUrl
) {
}
