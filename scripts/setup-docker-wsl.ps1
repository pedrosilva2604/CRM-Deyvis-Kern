$ErrorActionPreference = 'Stop'
$distro = 'Ubuntu-24.04'

function Invoke-Checked([scriptblock]$cmd, [string]$step) {
  & $cmd
  if ($LASTEXITCODE -ne 0) { throw "Falhou: $step (exit $LASTEXITCODE)" }
}

$wslConfig = "$env:USERPROFILE\.wslconfig"
if (-not (Test-Path $wslConfig)) {
@'
[wsl2]
memory=6GB
'@ | Set-Content -Encoding ascii $wslConfig
}

wsl --set-default-version 2
if (-not ((wsl -l -q) -replace "`0", '' | Where-Object { $_ -eq $distro })) {
  Invoke-Checked { wsl --install -d $distro --no-launch } 'instalar distro'
}

Invoke-Checked {
  wsl -d $distro -u root -- bash -c @'
set -e
grep -q "systemd=true" /etc/wsl.conf 2>/dev/null || printf "[boot]\nsystemd=true\n" >> /etc/wsl.conf
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
'@
} 'instalar docker'

wsl --shutdown
Invoke-Checked { wsl -d $distro -u root -- bash -c 'systemctl enable --now docker && docker version && docker compose version' } 'iniciar docker'

Write-Host "Docker pronto. Use: .\scripts\docker.ps1 compose up -d"
