param(
    [ValidateRange(1,65535)][int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 8080 }),
    [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$portCheck = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
try { $portCheck.Start() }
catch { throw "Port $Port is already in use. Stop the other app or choose another PORT." }
finally { $portCheck.Stop() }
& (Join-Path $PSScriptRoot 'build.ps1')
. (Join-Path $PSScriptRoot 'java-tools.ps1')
$JavaTools = Get-ChordMapJavaTools
$env:PORT = [string]$Port
$url = "http://localhost:$Port/"
$stdout = [IO.Path]::GetTempFileName()
$stderr = [IO.Path]::GetTempFileName()
$serverProcess = $null
try {
    $serverProcess = Start-Process -FilePath $JavaTools.Java -ArgumentList @('-jar', ('"' + (Join-Path $PSScriptRoot 'build\chord-map-studio.jar') + '"')) -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $deadline = (Get-Date).AddSeconds(30)
    $ready = $false
    while ((Get-Date) -lt $deadline) {
        if ($serverProcess.HasExited) { throw ('App could not start. Check whether port ' + $Port + ' is already in use. ' + (Get-Content -LiteralPath $stderr -Raw)) }
        # Wait for this process's startup message, not another server on the port.
        if ((Get-Content -LiteralPath $stdout -Raw) -match 'Chord Map Studio is ready') {
            try { $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2; $ready = $response.StatusCode -eq 200 } catch { }
            if ($ready) { break }
        }
        Start-Sleep -Milliseconds 200
    }
    if (-not $ready) { throw 'Timed out waiting for the app to start.' }
    Write-Host "Chord Map Studio is running at $url"
    Write-Host 'Keep this window open. Press Ctrl+C to stop the app.'
    if (-not $NoBrowser) {
        try { Start-Process $url }
        catch { Write-Warning "Could not open the default browser. Open $url manually. The app is still running." }
    }
    while (-not $serverProcess.HasExited) { Start-Sleep -Milliseconds 250 }
    if ($serverProcess.ExitCode -ne 0) { throw (Get-Content -LiteralPath $stderr -Raw) }
} finally {
    if ($serverProcess -and -not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath $stdout,$stderr -ErrorAction SilentlyContinue
}
