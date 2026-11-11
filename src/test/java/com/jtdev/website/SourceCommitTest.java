package com.jtdev.website;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SourceCommitTest {
    @Test
    void acceptsOnlyAnExactFortyCharacterHexadecimalCommit() {
        assertEquals("a".repeat(40), SourceCommit.normalize("A".repeat(40)));
        assertEquals("unknown", SourceCommit.normalize("a".repeat(39)));
        assertEquals("unknown", SourceCommit.normalize("a".repeat(40) + "0"));
        assertEquals("unknown", SourceCommit.normalize(null));
    }

    @Test
    void packagedIdentityAlwaysWinsAndMalformedPresentIdentityFailsClosed() {
        assertEquals("a".repeat(40), SourceCommit.resolve("A".repeat(40), "b".repeat(40), true));
        assertThrows(IllegalStateException.class,
                () -> SourceCommit.resolve("not-a-commit", "b".repeat(40), true));
    }

    @Test
    void unPackagedFallbackIsLimitedToExplicitDevelopmentProfiles() {
        assertEquals("a".repeat(40), SourceCommit.resolve(null, "A".repeat(40), true));
        assertEquals("unknown", SourceCommit.resolve(null, "a".repeat(40), false));
        assertEquals("unknown", SourceCommit.resolve(null, "short", true));
    }

    @Test
    void fixedPackagedResourceAcceptsOneLineEndingAndRejectsMalformedContents() {
        assertEquals("a".repeat(40), SourceCommit.readPackagedCommit(resource("A".repeat(40) + "\n")));
        assertEquals("b".repeat(40), SourceCommit.readPackagedCommit(resource("B".repeat(40) + "\r\n")));
        assertEquals(null, SourceCommit.readPackagedCommit(resource(null)));
        assertThrows(IllegalStateException.class,
                () -> SourceCommit.readPackagedCommit(resource("a".repeat(40) + " extra\n")));
        assertThrows(IllegalStateException.class,
                () -> SourceCommit.readPackagedCommit(resource("a".repeat(40) + "0")));
    }

    private static ClassLoader resource(String contents) {
        return new ClassLoader(null) {
            @Override
            public java.io.InputStream getResourceAsStream(String name) {
                if (!SourceCommit.PACKAGED_RESOURCE.equals(name) || contents == null) {
                    return null;
                }
                return new ByteArrayInputStream(contents.getBytes(StandardCharsets.US_ASCII));
            }
        };
    }
}
