package studio.chordmap;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class ChordEngine {
    private static final String[] SHARPS = {"C","C#","D","D#","E","F","F#","G","G#","A","A#","B"};
    private static final String[] FLATS = {"C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"};
    private static final int[] TUNING = {40,45,50,55,59,64};
    private static final Pattern SYMBOL = Pattern.compile("^([A-Ga-g])([#b]?)(.*?)(?:/([A-Ga-g])([#b]?))?$");
    private static final LinkedHashMap<String, Quality> QUALITIES = new LinkedHashMap<>();

    static {
        quality("", "major", 0,4,7); quality("maj", "major", 0,4,7); quality("m", "minor", 0,3,7); quality("min", "minor", 0,3,7);
        quality("5", "power chord", 0,7); quality("7", "dominant 7th", 0,4,7,10); quality("maj7", "major 7th", 0,4,7,11);
        quality("M7", "major 7th", 0,4,7,11); quality("m7", "minor 7th", 0,3,7,10); quality("min7", "minor 7th", 0,3,7,10);
        quality("6", "major 6th", 0,4,7,9); quality("m6", "minor 6th", 0,3,7,9); quality("9", "dominant 9th", 0,2,4,7,10);
        quality("maj9", "major 9th", 0,2,4,7,11); quality("m9", "minor 9th", 0,2,3,7,10); quality("add9", "add 9", 0,2,4,7);
        quality("sus2", "suspended 2nd", 0,2,7); quality("sus4", "suspended 4th", 0,5,7); quality("sus", "suspended 4th", 0,5,7);
        quality("dim", "diminished", 0,3,6); quality("dim7", "diminished 7th", 0,3,6,9); quality("aug", "augmented", 0,4,8); quality("+", "augmented", 0,4,8);
    }

    private static void quality(String key, String name, int... intervals) { QUALITIES.put(key, new Quality(name, intervals)); }

    static Chord parse(String input) {
        String cleaned = input == null ? "" : input.strip().replace("♯", "#").replace("♭", "b").replaceAll("\\s+", "");
        if (cleaned.length() > 16) throw new IllegalArgumentException("Keep chord names under 16 characters.");
        Matcher m = SYMBOL.matcher(cleaned);
        if (!m.matches()) throw new IllegalArgumentException("Try a chord like C, F#m7, Bbmaj7, or D/F#.");
        boolean preferFlats = "b".equals(m.group(2)) || "b".equals(m.group(5));
        int root = pitch(m.group(1) + m.group(2));
        String rawQuality = m.group(3);
        // Suspended suffixes have no case-dependent musical meaning (unlike M7/m7).
        if (rawQuality.matches("(?i)sus[24]?")) rawQuality = rawQuality.toLowerCase(Locale.ROOT);
        Quality quality = QUALITIES.get(rawQuality);
        if (quality == null) throw new IllegalArgumentException("That chord quality isn't supported yet. Try major, m, 5, 6, 7, maj7, m7, 9, add9, sus2, sus4, dim, or aug.");
        Integer bass = m.group(4) == null ? null : pitch(m.group(4) + m.group(5));
        String[] names = preferFlats ? FLATS : SHARPS;
        String normalized = names[root] + rawQuality + (bass == null ? "" : "/" + names[bass]);
        Set<Integer> tones = new LinkedHashSet<>();
        for (int i : quality.intervals) tones.add((root + i) % 12);
        if (bass != null && !tones.contains(bass)) throw new IllegalArgumentException("The slash bass must be a note in the chord.");
        List<Voicing> voicings = generate(tones, root, bass);
        if (voicings.isEmpty()) throw new IllegalArgumentException("No comfortable standard-tuning voicing was found.");
        List<String> toneNames = tones.stream().map(i -> names[i]).toList();
        return new Chord(normalized, names[root] + " " + quality.name, toneNames, voicings);
    }

    private static List<Voicing> generate(Set<Integer> tones, int root, Integer bass) {
        List<Voicing> candidates = new ArrayList<>();
        for (int start = 0; start <= 9; start++) {
            int[][] options = new int[6][];
            for (int s = 0; s < 6; s++) {
                List<Integer> frets = new ArrayList<>(); frets.add(-1);
                if (start == 0 && tones.contains(TUNING[s] % 12)) frets.add(0);
                for (int f = Math.max(1, start); f <= Math.max(4, start + 3); f++) if (tones.contains((TUNING[s] + f) % 12)) frets.add(f);
                options[s] = frets.stream().mapToInt(i -> i).toArray();
            }
            search(options, 0, new int[6], tones, root, bass, candidates);
        }
        candidates.sort(Comparator.comparingDouble(Voicing::score));
        List<Voicing> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Voicing v : candidates) {
            String shape = Arrays.toString(v.frets);
            if (seen.add(shape)) result.add(v);
            if (result.size() == 8) break;
        }
        return result;
    }

    private static void search(int[][] options, int string, int[] frets, Set<Integer> tones, int root, Integer bass, List<Voicing> out) {
        if (out.size() > 15000) return;
        if (string == 6) {
            evaluate(frets, tones, root, bass).ifPresent(out::add); return;
        }
        for (int f : options[string]) { frets[string] = f; search(options, string + 1, frets, tones, root, bass, out); }
    }

    private static Optional<Voicing> evaluate(int[] source, Set<Integer> tones, int root, Integer bass) {
        int sounding = 0, min = 99, max = 0, lowestPitch = 999; Set<Integer> covered = new HashSet<>();
        for (int s = 0; s < 6; s++) if (source[s] >= 0) {
            sounding++; int pitch = TUNING[s] + source[s]; lowestPitch = Math.min(lowestPitch, pitch); covered.add(pitch % 12);
            if (source[s] > 0) { min = Math.min(min, source[s]); max = Math.max(max, source[s]); }
        }
        if (sounding < 3 || !covered.containsAll(tones)) return Optional.empty();
        if (max > 0 && max - min > 3) return Optional.empty();
        int desiredBass = bass == null ? root : bass;
        if (lowestPitch % 12 != desiredBass) return Optional.empty();
        int muted = 6 - sounding; int open = (int) Arrays.stream(source).filter(f -> f == 0).count();
        int firstSounding = 0, lastSounding = 5;
        while (firstSounding < 6 && source[firstSounding] < 0) firstSounding++;
        while (lastSounding >= 0 && source[lastSounding] < 0) lastSounding--;
        int internalMutes = 0;
        for (int s = firstSounding; s <= lastSounding; s++) if (source[s] < 0) internalMutes++;
        double highFretOpenPenalty = max >= 3 ? open * 2.2 : 0;
        double score = (min == 99 ? 0 : min * 1.35) + muted * 1.1 + (max - (min == 99 ? 0 : min)) * 2.0
                + internalMutes * 3.0 + highFretOpenPenalty - open * .7;
        int[] fingers = assignFingers(source);
        return Optional.of(new Voicing(source.clone(), fingers, score));
    }

    private static int[] assignFingers(int[] frets) {
        int[] fingers = new int[6];
        int lowest = Arrays.stream(frets).filter(f -> f > 0).min().orElse(0);
        List<Integer> lowestStrings = new ArrayList<>();
        for (int s = 0; s < 6; s++) if (frets[s] == lowest) lowestStrings.add(s);
        boolean lowestBarre = lowestStrings.size() > 1;
        if (lowestBarre) for (int s : lowestStrings) fingers[s] = 1;

        int nextFinger = lowestBarre ? 2 : 1;
        List<Integer> remaining = new ArrayList<>();
        for (int s = 0; s < 6; s++) if (frets[s] > 0 && fingers[s] == 0) remaining.add(s);
        remaining.sort(Comparator.comparingInt((Integer s) -> frets[s]).thenComparingInt(s -> s));
        for (int s : remaining) fingers[s] = Math.min(4, nextFinger++);
        return fingers;
    }

    static String toJson(Chord chord) {
        StringBuilder b = new StringBuilder("{\"symbol\":\"").append(escape(chord.symbol)).append("\",\"name\":\"").append(escape(chord.name)).append("\",\"tones\":[");
        for (int i=0;i<chord.tones.size();i++) { if(i>0)b.append(','); b.append('"').append(escape(chord.tones.get(i))).append('"'); }
        b.append("],\"voicings\":[");
        for (int i=0;i<chord.voicings.size();i++) { if(i>0)b.append(','); Voicing v=chord.voicings.get(i); b.append("{\"frets\":").append(Arrays.toString(v.frets)).append(",\"fingers\":").append(Arrays.toString(v.fingers)).append('}'); }
        return b.append("]}").toString();
    }

    private static int pitch(String note) {
        return switch (note.toUpperCase(Locale.ROOT)) {
            case "C" -> 0; case "C#", "DB" -> 1; case "D" -> 2; case "D#", "EB" -> 3; case "E", "FB" -> 4;
            case "F", "E#" -> 5; case "F#", "GB" -> 6; case "G" -> 7; case "G#", "AB" -> 8; case "A" -> 9;
            case "A#", "BB" -> 10; case "B", "CB" -> 11; default -> throw new IllegalArgumentException("Unknown note: " + note);
        };
    }
    private static String escape(String s) { return s.replace("\\","\\\\").replace("\"","\\\""); }

    record Quality(String name, int[] intervals) {}
    record Voicing(int[] frets, int[] fingers, double score) {}
    record Chord(String symbol, String name, List<String> tones, List<Voicing> voicings) {}
}
