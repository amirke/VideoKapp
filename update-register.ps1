param([Parameter(Mandatory=$true)][string]$ExpectedExe, [Parameter(Mandatory=$true)][string]$NewExe)
$ErrorActionPreference = 'Stop'
$key = 'HKCU:\Software\Classes\videokapp\shell\open\command'
$current = if (Test-Path $key) { (Get-Item $key).GetValue('') } else { '' }
if (!$current.StartsWith(('"' + $ExpectedExe + '"'), [StringComparison]::OrdinalIgnoreCase)) { Write-Output 'Portable update: system shortcuts unchanged.'; exit 0 }
if (!(Test-Path -LiteralPath $NewExe)) { throw 'New executable missing.' }
Set-Item -Path $key -Value ('"' + $NewExe + '" -- "%1"')
$shortcutShell = New-Object -ComObject WScript.Shell
foreach ($folder in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
  $link = Join-Path $folder 'VideoKapp.lnk'
  $shortcut = $shortcutShell.CreateShortcut($link)
  if ($shortcut.TargetPath -and $shortcut.TargetPath -ne $ExpectedExe) { continue }
  $shortcut.TargetPath = $NewExe
  $shortcut.WorkingDirectory = Split-Path -Parent $NewExe
  $shortcut.Save()
}
Write-Output 'Updated desktop links and website launch.'
