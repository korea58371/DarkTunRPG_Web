# PowerShell launcher for local dev server (UNC-safe)
param(
  [int]$Port = 5500,
  [switch]$Standalone
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$baseUrl = "http://localhost:$Port/"
$startPage = if ($Standalone) { 'index-standalone.html' } else { 'index.html' }

function Start-ServerPython {
  Start-Process -FilePath "python" -ArgumentList "-m http.server $Port --directory `"$here`"" -WindowStyle Hidden | Out-Null
}

function Start-ServerNode {
  Start-Process -FilePath "npx" -ArgumentList "http-server -p $Port -c-1 ." -WorkingDirectory $here -WindowStyle Hidden | Out-Null
}

try {
  # Try python first
  if (Get-Command python -ErrorAction SilentlyContinue) {
    Start-ServerPython
  } elseif (Get-Command node -ErrorAction SilentlyContinue) {
    Start-ServerNode
  } else {
    Write-Host "[!] Python 또는 Node.js가 필요합니다." -ForegroundColor Yellow
    Write-Host "    https://www.python.org/ 또는 https://nodejs.org/ 설치 후 다시 실행하세요."
    exit 1
  }

  Start-Sleep -Milliseconds 900
  Start-Process "$baseUrl$startPage"
}
catch {
  Write-Error $_
  exit 1
}


