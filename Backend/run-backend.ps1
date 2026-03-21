# Stop anything still bound to port 8000 (fixes stale uvicorn --reload workers returning HTTP 500)
$lines = netstat -ano | Select-String ':8000.*LISTENING'
foreach ($line in $lines) {
  $parts = ($line -split '\s+') | Where-Object { $_ -ne '' }
  $owningPid = $parts[-1]
  if ($owningPid -match '^\d+$') {
    try { Stop-Process -Id ([int]$owningPid) -Force -ErrorAction SilentlyContinue } catch {}
  }
}
Start-Sleep -Milliseconds 500

Set-Location $PSScriptRoot
if (Test-Path .\venv\Scripts\Activate.ps1) { .\venv\Scripts\Activate.ps1 }
Write-Host "Starting backend on http://127.0.0.1:8000 (Press Ctrl+C to stop)" -ForegroundColor Green
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
