param([Parameter(Mandatory=$true)][string]$Archive, [Parameter(Mandatory=$true)][string]$Destination, [Parameter(Mandatory=$true)][string]$Spec)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$allowed = @{}
foreach ($file in (Get-Content -LiteralPath $Spec -Raw | ConvertFrom-Json)) { $allowed[$file.path] = $file }
$root = [IO.Path]::GetFullPath($Destination).TrimEnd('\') + '\'
$zip = [IO.Compression.ZipFile]::OpenRead($Archive)
$seen = @{}
try {
  foreach ($entry in $zip.Entries) {
    $name = $entry.FullName
    if (!$allowed.ContainsKey($name) -or $seen.ContainsKey($name) -or $entry.Length -ne $allowed[$name].bytes -or $name.Contains('\')) { throw 'Unexpected archive entry.' }
    $target = [IO.Path]::GetFullPath((Join-Path $root $name))
    if (!$target.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path outside staging folder.' }
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
    $inputStream = $entry.Open()
    try { $outputStream = [IO.File]::Open($target, [IO.FileMode]::CreateNew); try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose() } } finally { $inputStream.Dispose() }
    $seen[$name] = $true
  }
  if ($seen.Count -ne $allowed.Count) { throw 'Incomplete update archive.' }
} finally { $zip.Dispose() }
