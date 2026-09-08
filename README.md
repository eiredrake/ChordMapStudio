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

## Docker Compose

Start or rebuild the application:

```powershell
docker compose up -d --build
```
