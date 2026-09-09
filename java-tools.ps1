$ErrorActionPreference = 'Stop'
function Get-ChordMapJavaTools {
    if ($env:JAVA_HOME) { $compiler = Join-Path $env:JAVA_HOME 'bin\javac.exe' }
    else {
        $command = Get-Command javac -ErrorAction SilentlyContinue
        if (-not $command) { throw 'Install a Java 21 or newer JDK, then set JAVA_HOME or add its bin folder to PATH.' }
        $compiler = $command.Source
    }
    if (-not (Test-Path -LiteralPath $compiler)) { throw 'JAVA_HOME must point to a Java 21 or newer JDK (not a JRE).' }
    $version = (& $compiler -version 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $version -notmatch 'javac (\d+)' -or [int]$Matches[1] -lt 21) { throw "Java 21 or newer JDK required. Found: $version" }
    $bin = Split-Path $compiler
    return @{ Compiler = $compiler; Java = (Join-Path $bin 'java.exe'); Jar = (Join-Path $bin 'jar.exe') }
}
