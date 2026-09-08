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

The included Compose configuration connects the app to an existing external Docker network named `proxy-tier`. Create that network once if it does not already exist:

```powershell
docker network create proxy-tier
```

Start or rebuild the application:

```powershell
docker compose up -d --build
```

In Nginx Proxy Manager, create a Proxy Host using:

- Forward hostname: `chord-map-studio`
- Forward port: `8080` (or the `CHORD_MAP_PORT` value from `.env`)
- Scheme: `http`

The application port is intentionally not published to the Docker host. Nginx Proxy Manager reaches it through `proxy-tier`, and Cloudflare can continue pointing at Nginx Proxy Manager as usual.
