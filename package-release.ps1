param([ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version = '1.0.0')
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'build.ps1')
$releaseDir = Join-Path $PSScriptRoot 'release'
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$stage = Join-Path $releaseDir ('stage-' + [guid]::NewGuid())
$bundle = Join-Path $stage "ChordMapStudio-$Version"
New-Item -ItemType Directory -Path $bundle -Force | Out-Null
foreach ($name in @('src','start.bat','run.ps1','build.ps1','java-tools.ps1','package-release.ps1','README.md','RELEASE.md','RELEASE-NOTES.md','Dockerfile','.dockerignore')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $bundle -Recurse
}
$jar = "chord-map-studio-$Version.jar"
$zip = "ChordMapStudio-$Version-windows.zip"
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'build\chord-map-studio.jar') -Destination (Join-Path $releaseDir $jar) -Force
Compress-Archive -Path $bundle -DestinationPath (Join-Path $releaseDir $zip) -Force
@($jar,$zip) | ForEach-Object {
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $releaseDir $_)).Hash.ToLowerInvariant()
    "$hash  $_"
} | Set-Content -Encoding ASCII -LiteralPath (Join-Path $releaseDir 'SHA256SUMS.txt')
Write-Host "Release files created in $releaseDir"
