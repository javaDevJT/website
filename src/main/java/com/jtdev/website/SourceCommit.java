package com.jtdev.website;

import java.util.Locale;

final class SourceCommit {
    private SourceCommit() {}

    static String normalize(String candidate) {
        return candidate != null && candidate.matches("(?i)[0-9a-f]{40}")
                ? candidate.toLowerCase(Locale.ROOT)
                : "unknown";
    }
}
