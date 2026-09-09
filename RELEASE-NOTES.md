# Chord Map Studio v1.0.0

First release of the standalone guitar chord and practice web app.

- Generate chord diagrams, choose voicings, export SVGs, and drag cards into order.
- Play individual chords or the collection with instrument and tempo controls.
- Save the collection, order, voicings, and practice selections in your browser.
- Practice with timed flashcards, preparation countdowns, automatic retries
  (including Infinite), and repeated decks.
- Listen through a selected microphone or USB audio interface, with live-note
  feedback and an automatic six-string tuner.
- Run with Docker, a Java JAR, or the Windows build-and-run launcher.

## Getting started

Windows users: install a Java 21+ **JDK**, extract
`ChordMapStudio-1.0.0-windows.zip`, and double-click `start.bat`. It builds and
starts the app, then opens your default browser. Keep the terminal open and
press Ctrl+C to stop. Java is not bundled.

Alternatively, with Java 21+, run `java -jar chord-map-studio-1.0.0.jar` and open
http://localhost:8080/. No Docker or database is required.

See [RELEASE.md](https://github.com/eiredrake/ChordMapStudio/blob/v1.0.0/RELEASE.md)
for port settings, prerequisites, troubleshooting, and packaging instructions.

Audio recognition remains a preview: input quality affects results, and it
checks chord identity rather than exact fingering. Saved decks are local to the
browser and site address. `SHA256SUMS.txt` contains the asset checksums.
