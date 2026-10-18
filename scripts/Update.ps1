$ErrorActionPreference = 'Stop'
$key = 'HKCU:\Software\Classes\videokapp\shell\open\command'
$command = if (Test-Path $key) { (Get-Item $key).GetValue('') } else { '' }
$exe = if ($command -match '^"([^"]+)"') { $Matches[1] } else { '' }
if (!$exe -or !(Test-Path -LiteralPath $exe)) {
  Add-Type -AssemblyName System.Windows.Forms
  $picker = New-Object System.Windows.Forms.OpenFileDialog
  $picker.Title = 'Choose the existing VideoKapp / ChronoMerge.exe'
  $picker.Filter = 'VideoKapp application (ChronoMerge.exe)|ChronoMerge.exe'
  if ($picker.ShowDialog() -ne 'OK') { exit 0 }
  $exe = $picker.FileName
}
if (!(Test-Path -LiteralPath (Join-Path (Split-Path -Parent $exe) 'resources\app\package.json'))) { throw 'Choose the existing application executable.' }
foreach ($process in @(Get-Process -Name ChronoMerge -ErrorAction SilentlyContinue)) {
  if ($process.Path -eq $exe) { throw 'Close VideoKapp first, then run Update.cmd again.' }
}
Write-Host 'Updating changed components only. Keep this window open. Ctrl+C stops preparation.'
$env:ELECTRON_RUN_AS_NODE = '1'
& $exe (Join-Path $PSScriptRoot 'bootstrap-update.cjs')
exit $LASTEXITCODE
