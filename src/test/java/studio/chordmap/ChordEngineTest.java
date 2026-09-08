package studio.chordmap;

import java.util.List;
import java.util.Set;
import java.util.HashSet;

/** Dependency-free regression checks; run after compiling with the main classes. */
public final class ChordEngineTest {
    public static void main(String[] args) {
        int[] tuning = {40, 45, 50, 55, 59, 64};
        for (String symbol : List.of("Bsus4", "BSus4", "BSUS4", "bSuS4", " B sus4 ")) {
            var chord = ChordEngine.parse(symbol);
            check(chord.symbol().equals("Bsus4"), "Normalized symbol: " + symbol);
            check(chord.tones().equals(List.of("B", "E", "F#")), "Bsus4 tones");
            check(chord.voicings().size() == 8, "Alternate voicings");
            for (var voicing : chord.voicings()) {
                Set<Integer> tones = new HashSet<>();
                int bass = Integer.MAX_VALUE;
                for (int s = 0; s < 6; s++) {
                    if (voicing.frets()[s] < 0) continue;
                    int pitch = tuning[s] + voicing.frets()[s];
                    tones.add(pitch % 12);
                    bass = Math.min(bass, pitch);
                }
                check(tones.equals(Set.of(11, 4, 6)), "Voicing must contain only and all Bsus4 tones");
                check(bass % 12 == 11, "B bass");
            }
        }
        check(ChordEngine.parse("BSUS2").symbol().equals("Bsus2"), "Suspended second");
        check(ChordEngine.parse("BSUS").symbol().equals("Bsus"), "Suspended alias");
        check(ChordEngine.parse("BM7").tones().equals(List.of("B", "D#", "F#", "A#")), "Major seventh preserved");
        check(ChordEngine.parse("Bm7").tones().equals(List.of("B", "D", "F#", "A")), "Minor seventh preserved");
        for (String symbol : List.of("C", "Am", "C#5", "F#m7", "Bbmaj7", "D/F#", "Asus4", "C9", "Cdim7", "Caug")) {
            check(!ChordEngine.parse(symbol).voicings().isEmpty(), "Baseline: " + symbol);
        }
        try {
            ChordEngine.parse("Bsus3");
            throw new AssertionError("Unsupported suspended quality accepted");
        } catch (IllegalArgumentException expected) {
            // Unsupported qualities should still be rejected.
        }
        System.out.println("Chord engine regression checks passed.");
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
