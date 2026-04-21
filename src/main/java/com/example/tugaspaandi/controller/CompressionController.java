package com.example.tugaspaandi.controller;

import com.example.tugaspaandi.model.CompressionResponse;
import com.example.tugaspaandi.model.StoredCompression;
import com.example.tugaspaandi.service.CompressionStore;
import com.example.tugaspaandi.service.LzoCompressionService;
import jakarta.validation.constraints.NotNull;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class CompressionController {

    private final LzoCompressionService compressionService;
    private final CompressionStore compressionStore;

    public CompressionController(LzoCompressionService compressionService, CompressionStore compressionStore) {
        this.compressionService = compressionService;
        this.compressionStore = compressionStore;
    }

    @PostMapping(value = "/compress", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CompressionResponse compressAac(@RequestParam("file") @NotNull MultipartFile file) throws IOException {
        validateAacFile(file);

        byte[] originalBytes = file.getBytes();
        byte[] compressedBytes = compressionService.compress(originalBytes);

        long originalBits = toBits(originalBytes.length);
        long compressedBits = toBits(compressedBytes.length);

        double rc = compressedBits == 0 ? 0.0 : (double) originalBits / compressedBits;
        double cr = originalBits == 0 ? 0.0 : ((double) compressedBits / originalBits) * 100.0;
        double rd = 100.0 - cr;

        String originalName = StringUtils.cleanPath(file.getOriginalFilename());
        String id = UUID.randomUUID().toString();
        String compressedName = originalName + ".lzo";

        compressionStore.put(new StoredCompression(
                id,
                originalName,
                compressedName,
                compressedBytes,
                "application/octet-stream"
        ));

        return new CompressionResponse(
                id,
                originalName,
                toMegabytes(originalBytes.length),
                toMegabytes(compressedBytes.length),
                originalBits,
                compressedBits,
                round2(rc),
                round2(cr),
                round2(rd),
                "/api/compress/" + id + "/download"
        );
    }

    @GetMapping("/compress/{id}/download")
    public ResponseEntity<ByteArrayResource> downloadCompressed(@PathVariable String id) {
        StoredCompression stored = compressionStore.get(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Compressed file not found"));

        ByteArrayResource resource = new ByteArrayResource(stored.compressedData());

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(stored.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + stored.compressedFileName() + "\"")
                .contentLength(stored.compressedData().length)
                .body(resource);
    }

    private void validateAacFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty");
        }

        String name = file.getOriginalFilename();
        if (name == null || !name.toLowerCase(Locale.ROOT).endsWith(".aac")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only .aac files are allowed");
        }
    }

    private long toBits(long bytes) {
        return bytes * 8L;
    }

    private double toMegabytes(long bytes) {
        return round4(bytes / (1024.0 * 1024.0));
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private double round4(double value) {
        return Math.round(value * 10000.0) / 10000.0;
    }
}
