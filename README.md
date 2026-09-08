# Chord Map Studio

A dependency-free, self-hosted Java 21 web application for generating guitar chord diagrams in standard tuning.

## Run

On Windows PowerShell:

```powershell
.\run.ps1
```

Then open [http://localhost:8080](http://localhost:8080). Set the `PORT` environment variable to use a different port.

## Supported chord symbols

Major, minor, power chords, 6ths, 7ths, 9ths, added 9ths, suspended, diminished, augmented, and slash chords. Examples: `C`, `Am`, `C#5`, `F#m7`, `Bbmaj7`, `D/F#`, `Asus4`.

The server uses only the Java standard library. No Maven, database, account, or internet connection is required.

## Listening practice (preview)

Add chords to the board, then use **Chord practice** below it. Select the cards,
choose a microphone or Rocksmith Real Tone Cable, and enable listening. Allow
audio access when the browser asks. Keep the strings quiet for the brief input
check, set 2–60 seconds per card, and start the deck. Mute the strings briefly
before each new attempt, then strum. A sustained match earns a green check and
advances the deck; a timeout offers Retry or Next without a penalty sound.

Listening requires HTTPS, except on localhost. All analysis happens locally in
the browser; audio is neither recorded nor uploaded. **Stop listening** releases
the input. Device changes refresh the list automatically where supported; use
**Refresh inputs** if needed. The cable is identified by its audio-device name.
A generic USB interface can be selected under **Microphone / other audio input**.
Detected means the browser can see the adapter, not that the guitar is connected.

The preview supports major, minor, and power chords in standard tuning at A=440.
Use a clean signal and a quiet room for microphone practice. It checks chord
identity, not exact fingering or whether every string rings. Extended and slash
chords remain available on the board but are excluded from listening decks.
Playing an example, hiding the tab, or losing the input pauses the attempt.
Enable listening and retry after reconnecting a device.

Validation covers generated plucks and bundled steel-guitar samples, wrong
chords, missing/extra tones, silence, noise, and session/device lifecycles.
Live microphone and Real Tone Cable accuracy still needs hardware testing;
there is no measured live accuracy claim. Start with C, Am, E, Em, G, and D and
compare correct strums with intentionally wrong ones using the listening preview.

Run the browser-logic checks with Node:

```powershell
node src/test/js/audio.test.cjs
node src/test/js/practice.test.cjs
node src/test/js/practice-ui.test.cjs
# Additional real-sample checks (requires ffmpeg on PATH only for this test):
node src/test/js/practice-samples.test.cjs
```

## Docker Compose

Start or rebuild the application:

```powershell
docker compose up -d --build
```
