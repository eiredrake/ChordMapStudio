# Running Chord Map Studio v1.0.0

## Windows: build, run, and open the browser

1. Install a **Java 21 or newer JDK**. A JRE alone cannot build the app.
   Set `JAVA_HOME` to the JDK folder, or put its `bin` folder on `PATH`.
   The launcher uses `JAVA_HOME` first, then looks for `javac` on `PATH`.
2. Download **ChordMapStudio-1.0.0-windows.zip** from the
   [v1.0.0 release](https://github.com/eiredrake/ChordMapStudio/releases/tag/v1.0.0).
3. Extract the entire ZIP into a writable folder. Do not run it inside the ZIP.
4. Double-click **start.bat**. It builds the app, starts the local server, waits
   until it is ready, and opens your default browser at **http://localhost:8080/**.
5. Keep the command window open. Press **Ctrl+C** to stop the app before closing
   the window. Closing the browser alone does not stop the server.

No Docker, database, Maven, or Node installation is needed to run the app.
The Windows launcher uses the built-in Windows PowerShell. Its execution-policy
override applies only to that launcher process; it does not change system policy.
Java is not bundled. The archive contains source and builds it locally.

### Choose another port

If another app or Docker container already uses port 8080, run this from the
extracted folder in Command Prompt:

```bat
set PORT=8081
start.bat
```

The browser will open **http://localhost:8081/**. In PowerShell you can instead run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1 -Port 8081
```

Add `-NoBrowser` to start the server without opening a browser. `build.ps1`
builds only. The launcher reports startup failures rather than opening a
different app that happens to occupy the chosen port.

### Use the prebuilt JAR (Windows, macOS, or Linux)

Install Java 21 or newer and download **chord-map-studio-1.0.0.jar**. Run:

```text
java -jar chord-map-studio-1.0.0.jar
```

Open **http://localhost:8080/** yourself. This command does not launch a browser
automatically. Set the `PORT` environment variable to change the port. Check
`java -version` if the JAR reports an unsupported class version.

### Audio and saved decks

Allow microphone permission when prompted; some browsers also require a click
to start audio. Select the microphone or USB guitar input on the main screen.
Audio stays in the browser. Clean, wired input is a useful starting point;
recognition is a preview and results depend on the signal.

Chord collections save in browser localStorage for the exact site address.
Changing browsers, hostnames, or ports uses a separate saved collection. Clearing
site data removes it. No deck data is stored in the release archive.

The server may be reachable from other computers if your firewall allows it.
This release does not configure your firewall or provide authentication.

## Build release assets from the repository

Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\package-release.ps1`.
The `release` folder receives the source/launcher ZIP, Java 21-compatible JAR,
and `SHA256SUMS.txt`. The ZIP excludes Git metadata, local Docker Compose network
settings, and existing build output. SHA-256 hashes can be checked with
`Get-FileHash -Algorithm SHA256 <filename>`.

Before publishing, run the Node checks listed in README.md and the recorded
sample checks with ffmpeg installed. Test `start.bat` from an extracted archive,
including a folder with spaces. Create the `v1.0.0` Git tag at the tested commit
and attach the three files in `release` to its GitHub release. Release notes are
in RELEASE-NOTES.md.
