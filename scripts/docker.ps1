$root = Split-Path $PSScriptRoot -Parent
$wslPath = (wsl.exe -d Ubuntu-24.04 wslpath -a ($root -replace '\\', '/')).Trim()
wsl.exe -d Ubuntu-24.04 -u root --cd $wslPath -- docker @args
