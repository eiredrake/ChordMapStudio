$ErrorActionPreference = 'Stop'
$OutputDir = Join-Path $PSScriptRoot 'build'
$ClassesDir = Join-Path $OutputDir 'classes'
New-Item -ItemType Directory -Force -Path $ClassesDir | Out-Null
Get-ChildItem -Recurse (Join-Path $PSScriptRoot 'src\main\java') -Filter *.java | ForEach-Object FullName | Set-Content (Join-Path $OutputDir 'sources.txt')
javac -encoding UTF-8 -d $ClassesDir "@$(Join-Path $OutputDir 'sources.txt')"
Copy-Item -Recurse -Force (Join-Path $PSScriptRoot 'src\main\resources\*') $ClassesDir
$Manifest = Join-Path $OutputDir 'MANIFEST.MF'
Set-Content $Manifest "Main-Class: studio.chordmap.ChordMapApplication`n"
jar --create --file (Join-Path $OutputDir 'chord-map-studio.jar') --manifest $Manifest -C $ClassesDir .
Write-Host "Built build\chord-map-studio.jar"
