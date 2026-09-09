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

The chord collection, order, selected voicings, and practice-card selections are
saved automatically in localStorage in this browser for this site address.
Reloads and app restarts restore the board, including an intentionally empty board.
Clearing browser site data removes it; collections do not sync between browsers.

**Tuner**, beside Play All and Stop, opens a tuner using the shared audio input.
Choose an input on the main screen; listening starts automatically. Follow the highlighted string on the guitar-neck diagram in standard
E–A–D–G–B–E tuning. Pluck one string at a time with a clean sound. The tuner
shows measured note, frequency, cents, and tune-up/tune-down guidance (green
within ±5 cents). Opening it pauses practice; closing it keeps listening enabled.
Input controls stay on the main screen. Changing the input releases the old stream and starts the new one. Refresh inputs only updates the list. Closing the page releases the device.

The practice modal's Live input panel shows the device, heard pitch classes,
missing or weak target notes, and other detected notes. These are estimates;
the confirmation bar and result explain whether a sustained match has passed.

Add chords to the board, then use **Chord practice** below it. Select the cards,
choose a microphone or Rocksmith Real Tone Cable. Listening starts automatically. Allow
audio access when the browser asks. Keep the strings quiet for the brief input
check, set 2–60 seconds per card, and start the deck. Mute the strings briefly
before each new attempt, then strum. A sustained match earns a green check and
advances the deck; a timeout offers Retry or Next without a penalty sound.

Practice cards open in a modal window. Click outside it, use Close, or press
Escape to pause and dismiss it. **Open practice** brings back the same card;
press **Spacebar** or **Retry card** to restart its timer. Spacebar only retries
inside the practice window and does not override typing or focused buttons.
Enable **Auto next card** to advance after a timeout, following a brief result
message. With this option off, timeouts wait for Retry or Next. Successful
matches continue to advance automatically. Closing the window cancels any
pending advance.

Enable **Retry chord after timeout** for automatic extra attempts on the same
card. The numeric limit accepts 0–10: **0 = Infinite**, retrying until a match;
1–10 allows that many extra attempts after the first. Each retry gets a full
card timer and a brief pause to mute the strings. A match advances normally.
After a finite limit, Auto next card controls whether to advance or wait.
Closing the modal, ending practice, or losing input cancels pending retries.

**Starting countdown** defaults to 3 seconds: the modal shows READY!, then 3, 2,
and 1 individually before the first card timer starts. Choose 0–30 seconds; 0
skips preparation. Closing the modal, hiding the tab, or losing the input cancels
preparation; retry starts it again. **Repeat deck** loops back to the first card
without another preparation countdown. Turn on **Auto next card** as well to
keep moving after timeouts. End session stops the loop; results count attempts
across passes.

Chord confirmation uses a short rolling window of matching audio evidence,
allowing brief detection dropouts as a strum decays. The confirmation meter shows
progress; only a confirmed result displays the green check. Wrong chords, sparse
accidental matches, and stale samples cannot accumulate indefinitely toward a pass.

Listening requires HTTPS, except on localhost. All analysis happens locally in
the browser; audio is neither recorded nor uploaded. Closing the page releases
the input. Device changes refresh the list automatically where supported; use
**Refresh inputs** if needed. The cable is identified by its audio-device name.
A generic USB interface can be selected under **Microphone / other audio input**.
Detected means the browser can see the adapter, not that the guitar is connected.

The preview supports major, minor, and power chords in standard tuning at A=440.
Use a clean signal and a quiet room for microphone practice. It checks chord
identity, not exact fingering or whether every string rings. Extended and slash
chords remain available on the board but are excluded from listening decks.
Playing an example, hiding the tab, or losing the input pauses the attempt.
Select the input or reopen the tuner after reconnecting a device. Browsers may require microphone permission and a click to start audio.

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
node src/test/js/tuner.test.cjs
node src/test/js/diagram.test.cjs
node src/test/js/storage.test.cjs
# Additional real-sample checks (requires ffmpeg on PATH only for this test):
node src/test/js/practice-samples.test.cjs
```

## Docker Compose

Start or rebuild the application:

```powershell
docker compose up -d --build
```
