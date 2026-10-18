param([string]$Archive)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$expectedHash = '0836CF94503B3497BFF0497EEBDA4E74F34017AB6D85C2D8E69F3F9900D5A496'
$cacheRoot = Join-Path $repoRoot '.cache'
New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
if (-not $Archive) {
    $Archive = Join-Path $cacheRoot 'ffmpeg-8.0-1.zip'
    if (-not (Test-Path -LiteralPath $Archive)) {
        Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/mifi/ffmpeg-builds/releases/download/8.0-1/ffmpeg-n8.0-latest-win64-gpl-shared-8.0.zip' -OutFile $Archive
    }
}
if ((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash -ne $expectedHash) {
    throw 'FFmpeg archive checksum mismatch. Nothing was installed.'
}
$stageRoot = Join-Path $cacheRoot ('extract-' + [guid]::NewGuid().ToString('N'))
Expand-Archive -LiteralPath $Archive -DestinationPath $stageRoot
$archiveRoot = Join-Path $stageRoot 'ffmpeg-n8.0-latest-win64-gpl-shared-8.0'
$archiveBin = Join-Path $archiveRoot 'bin'
$binaryRoot = Join-Path $repoRoot 'bin'
New-Item -ItemType Directory -Path $binaryRoot -Force | Out-Null
foreach ($name in @('ffmpeg.exe','ffprobe.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $archiveBin $name))) { throw "Missing $name in archive" }
}
Get-ChildItem -LiteralPath $archiveBin | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $binaryRoot -Recurse -Force }
Copy-Item -LiteralPath (Join-Path $archiveRoot 'LICENSE.txt') -Destination (Join-Path $binaryRoot 'LICENSE-FFmpeg.txt') -Force
Copy-Item -LiteralPath (Join-Path $archiveRoot 'doc') -Destination $binaryRoot -Recurse -Force
$ffmpegVersion = & (Join-Path $binaryRoot 'ffmpeg.exe') -version
if ($LASTEXITCODE -ne 0) { throw 'FFmpeg could not start.' }
Write-Output $ffmpegVersion[0]
$ffprobeVersion = & (Join-Path $binaryRoot 'ffprobe.exe') -version
if ($LASTEXITCODE -ne 0) { throw 'FFprobe could not start.' }
Write-Output $ffprobeVersion[0]
Write-Output 'Verified FFmpeg installed in bin/.'
