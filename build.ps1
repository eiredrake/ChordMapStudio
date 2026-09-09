$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'java-tools.ps1')
$JavaTools = Get-ChordMapJavaTools
$OutputDir = Join-Path $PSScriptRoot 'build'
$ClassesDir = Join-Path $OutputDir 'classes'
New-Item -ItemType Directory -Force -Path $ClassesDir | Out-Null
Get-ChildItem -Recurse (Join-Path $PSScriptRoot 'src\main\java') -Filter *.java | ForEach-Object { '"' + ($_.FullName -replace '\\','/') + '"' } | Set-Content (Join-Path $OutputDir 'sources.txt')
& $JavaTools.Compiler --release 21 -encoding UTF-8 -d $ClassesDir "@$(Join-Path $OutputDir 'sources.txt')"
if ($LASTEXITCODE -ne 0) { throw 'Java compilation failed. The app was not started.' }
Copy-Item -Recurse -Force (Join-Path $PSScriptRoot 'src\main\resources\*') $ClassesDir
$Manifest = Join-Path $OutputDir 'MANIFEST.MF'
Set-Content $Manifest "Main-Class: studio.chordmap.ChordMapApplication`n"
& $JavaTools.Jar --create --file (Join-Path $OutputDir 'chord-map-studio.jar') --manifest $Manifest -C $ClassesDir .
if ($LASTEXITCODE -ne 0) { throw 'Creating the application JAR failed.' }
Write-Host "Built build\chord-map-studio.jar"
