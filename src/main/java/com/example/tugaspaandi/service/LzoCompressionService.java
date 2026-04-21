package com.example.tugaspaandi.service;

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Map;

@Service
public class LzoCompressionService {

    private static final int MIN_MATCH = 3;
    private static final int MAX_OFFSET = 65535;
    private static final int MAX_MATCH = 130;

    public byte[] compress(byte[] input) {
        if (input == null || input.length == 0) {
            return new byte[0];
        }

        // Follow journal principle: normalize input through hexadecimal representation first.
        String hexStream = toHex(input);
        byte[] normalizedInput = fromHex(hexStream);

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        Map<Integer, Integer> dictionary = new HashMap<>();

        int literalStart = 0;
        int i = 0;

        while (i < normalizedInput.length) {
            if (i + MIN_MATCH <= normalizedInput.length) {
                int key = threeByteKey(normalizedInput, i);
                Integer previousPos = dictionary.get(key);
                dictionary.put(key, i);

                if (previousPos != null) {
                    int offset = i - previousPos;
                    if (offset > 0 && offset <= MAX_OFFSET) {
                        int matchLength = countMatch(normalizedInput, previousPos, i);
                        if (matchLength >= MIN_MATCH) {
                            writeLiterals(normalizedInput, literalStart, i - literalStart, output);
                            writeMatch(offset, matchLength, output);
                            i += matchLength;
                            literalStart = i;
                            continue;
                        }
                    }
                }
            }
            i++;
        }

        writeLiterals(normalizedInput, literalStart, normalizedInput.length - literalStart, output);
        return output.toByteArray();
    }

    private String toHex(byte[] input) {
        StringBuilder sb = new StringBuilder(input.length * 2);
        for (byte b : input) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }

    private byte[] fromHex(String hex) {
        int len = hex.length();
        byte[] out = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            int high = Character.digit(hex.charAt(i), 16);
            int low = Character.digit(hex.charAt(i + 1), 16);
            out[i / 2] = (byte) ((high << 4) + low);
        }
        return out;
    }

    private int threeByteKey(byte[] input, int index) {
        int b1 = input[index] & 0xFF;
        int b2 = input[index + 1] & 0xFF;
        int b3 = input[index + 2] & 0xFF;
        return (b1 << 16) | (b2 << 8) | b3;
    }

    private int countMatch(byte[] input, int p1, int p2) {
        int len = 0;
        int maxLen = Math.min(MAX_MATCH, input.length - p2);
        while (len < maxLen && input[p1 + len] == input[p2 + len]) {
            len++;
        }
        return len;
    }

    private void writeLiterals(byte[] input, int start, int length, ByteArrayOutputStream out) {
        if (length <= 0) {
            return;
        }

        int cursor = 0;
        while (cursor < length) {
            int chunk = Math.min(127, length - cursor);
            out.write(chunk);
            out.writeBytes(slice(input, start + cursor, chunk));
            cursor += chunk;
        }
    }

    private void writeMatch(int offset, int length, ByteArrayOutputStream out) {
        int remaining = length;
        while (remaining > 0) {
            int chunk = Math.min(MAX_MATCH, remaining);
            int token = 0x80 | (chunk - MIN_MATCH);
            out.write(token);
            out.write((offset >> 8) & 0xFF);
            out.write(offset & 0xFF);
            remaining -= chunk;
        }
    }

    private byte[] slice(byte[] source, int start, int len) {
        byte[] result = new byte[len];
        System.arraycopy(source, start, result, 0, len);
        return result;
    }
}
