param([switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
$sourceRoot = $PSScriptRoot
$sourceExe = Join-Path $sourceRoot 'ChronoMerge.exe'
$manifest = Join-Path $sourceRoot 'resources\app\package.json'
if (!(Test-Path -LiteralPath $sourceExe) -or !(Test-Path -LiteralPath $manifest)) {
    throw 'Extract the entire VideoKapp Windows ZIP first, then run Install.cmd from that folder.'
}
$version = (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid application version.' }
$installRoot = Join-Path $env:LOCALAPPDATA "Programs\VideoKapp\$version"
$installedExe = Join-Path $installRoot 'ChronoMerge.exe'
$protocolCommand = '"' + $installedExe + '" -- "%1"'
if ($ValidateOnly) {
    [PSCustomObject]@{Source=$sourceRoot; Destination=$installRoot; Protocol='videokapp://open'; Command=$protocolCommand} | Format-List
    exit 0
}
if ($sourceRoot.TrimEnd('\') -eq $installRoot.TrimEnd('\')) { throw 'Run the installer from the extracted download folder.' }
foreach ($process in @(Get-Process -Name ChronoMerge -ErrorAction SilentlyContinue)) {
    if ($process.Path -eq $installedExe) { throw 'Close the installed VideoKapp application before installing this version again.' }
}
Write-Host "Installing VideoKapp $version for the current Windows user..."
New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
$entries = @(Get-ChildItem -LiteralPath $sourceRoot)
for ($i=0; $i -lt $entries.Count; $i++) {
    Write-Progress -Activity 'Installing VideoKapp' -Status $entries[$i].Name -PercentComplete (100*$i/$entries.Count)
    Copy-Item -LiteralPath $entries[$i].FullName -Destination $installRoot -Recurse -Force
}
Write-Progress -Activity 'Installing VideoKapp' -Completed
if (!(Test-Path -LiteralPath (Join-Path $installRoot 'resources\app\bin\ffmpeg.exe'))) { throw 'FFmpeg is missing. Download and extract the complete ZIP again.' }
# Per-user protocol: no administrator rights, URL passed only as data after --.
$protocol = 'HKCU:\Software\Classes\videokapp'
New-Item -Path "$protocol\shell\open\command" -Force | Out-Null
Set-Item -Path $protocol -Value 'URL:VideoKapp'
New-ItemProperty -Path $protocol -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
Set-Item -Path "$protocol\shell\open\command" -Value $protocolCommand
$shortcutShell = New-Object -ComObject WScript.Shell
foreach ($folder in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
    $shortcut = $shortcutShell.CreateShortcut((Join-Path $folder 'VideoKapp.lnk'))
    $shortcut.TargetPath = $installedExe
    $shortcut.WorkingDirectory = $installRoot
    $shortcut.Description = 'VideoKapp video and GPS editor'
    $shortcut.Save()
}
Write-Host "Installed successfully: $installRoot" -ForegroundColor Green
Write-Host 'Open VideoKapp from the desktop shortcut or the Open VideoKapp button on the website.'
Write-Host 'Your videos, settings and credentials were not changed. No app window was opened.'
