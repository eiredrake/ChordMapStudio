& (Join-Path $PSScriptRoot 'build.ps1')
$JavaCompiler = Get-Command javac -ErrorAction Stop
$JavaExecutable = Join-Path (Split-Path $JavaCompiler.Source) 'java.exe'
& $JavaExecutable -jar (Join-Path $PSScriptRoot 'build\chord-map-studio.jar')
