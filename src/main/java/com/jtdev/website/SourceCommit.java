package com.jtdev.website;

import org.springframework.core.env.Environment;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Resolves application source identity from a fixed resource packaged in the image JAR. */
public final class SourceCommit {
    static final String PACKAGED_RESOURCE = "META-INF/website-source-commit";
    private static final Pattern COMMIT = Pattern.compile("(?i)[0-9a-f]{40}");
    private static final Set<String> DEVELOPMENT_PROFILES = Set.of("local", "development", "dev", "test");
    private static final String PACKAGED_COMMIT = readPackagedCommit(SourceCommit.class.getClassLoader());

    private SourceCommit() {}

    /**
     * The image resource wins in every profile. Mutable configuration is only a
     * development fallback for an un-packaged local build.
     */
    public static String resolve(Environment environment) {
        boolean development = java.util.Arrays.stream(environment.getActiveProfiles())
                .map(profile -> profile.toLowerCase(Locale.ROOT))
                .anyMatch(DEVELOPMENT_PROFILES::contains);
        return resolve(PACKAGED_COMMIT, environment.getProperty("QB_SOURCE_COMMIT"), development);
    }

    static String resolve(String packaged, String configuredFallback, boolean developmentProfile) {
        if (packaged != null) {
            if (!COMMIT.matcher(packaged).matches()) {
                throw malformedPackagedIdentity();
            }
            return packaged.toLowerCase(Locale.ROOT);
        }
        return developmentProfile ? normalize(configuredFallback) : "unknown";
    }

    static String normalize(String candidate) {
        return candidate != null && COMMIT.matcher(candidate).matches()
                ? candidate.toLowerCase(Locale.ROOT)
                : "unknown";
    }

    static String readPackagedCommit(ClassLoader classLoader) {
        final InputStream resource;
        try {
            resource = classLoader.getResourceAsStream(PACKAGED_RESOURCE);
        } catch (RuntimeException exception) {
            throw new IllegalStateException("Packaged Website source identity could not be read");
        }
        if (resource == null) {
            return null;
        }

        final byte[] bytes;
        try (InputStream input = resource) {
            bytes = input.readNBytes(43);
        } catch (IOException | RuntimeException exception) {
            throw new IllegalStateException("Packaged Website source identity could not be read");
        }
        if (bytes.length > 42) {
            throw malformedPackagedIdentity();
        }
        String candidate = new String(bytes, StandardCharsets.US_ASCII);
        if (candidate.endsWith("\r\n")) {
            candidate = candidate.substring(0, candidate.length() - 2);
        } else if (candidate.endsWith("\n")) {
            candidate = candidate.substring(0, candidate.length() - 1);
        }
        if (!COMMIT.matcher(candidate).matches()) {
            throw malformedPackagedIdentity();
        }
        return candidate.toLowerCase(Locale.ROOT);
    }

    private static IllegalStateException malformedPackagedIdentity() {
        return new IllegalStateException("Packaged Website source identity is malformed");
    }
}
