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

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        Map<Integer, Integer> dictionary = new HashMap<>();

        int literalStart = 0;
        int i = 0;

        while (i < input.length) {
            if (i + MIN_MATCH <= input.length) {
                int key = threeByteKey(input, i);
                Integer previousPos = dictionary.get(key);
                dictionary.put(key, i);

                if (previousPos != null) {
                    int offset = i - previousPos;
                    if (offset > 0 && offset <= MAX_OFFSET) {
                        int matchLength = countMatch(input, previousPos, i);
                        if (matchLength >= MIN_MATCH) {
                            writeLiterals(input, literalStart, i - literalStart, output);
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

        writeLiterals(input, literalStart, input.length - literalStart, output);
        return output.toByteArray();
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
