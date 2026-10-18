param([string]$Root, [string]$Output, [string]$Spec)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open($Output, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in (Get-Content -LiteralPath $Spec -Raw | ConvertFrom-Json)) {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $Root $file.path), $file.path, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $zip.Dispose() }
