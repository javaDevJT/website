package com.jtdev.website;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SourceCommitTest {
    @Test
    void acceptsOnlyAnExactFortyCharacterHexadecimalCommit() {
        assertEquals("a".repeat(40), SourceCommit.normalize("A".repeat(40)));
        assertEquals("unknown", SourceCommit.normalize("a".repeat(39)));
        assertEquals("unknown", SourceCommit.normalize("a".repeat(40) + "0"));
        assertEquals("unknown", SourceCommit.normalize(null));
    }
}
