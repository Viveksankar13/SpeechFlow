# SpeechFlow Local Development Launcher
# =====================================================================
# NOTE: Windows reserves ports 8000-8001 on many machines.
#       The backend defaults to port 8080 for local development.
#       Update NEXT_PUBLIC_API_BASE_URL in frontend/.env.local if changed.
# =====================================================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "      Starting SpeechFlow Services      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Pick a free port for the backend (default 8080, fall back to 9000)
$backendPort = 8080
$PortsToTry = @(8080, 9000, 7000, 5050, 4000)
foreach ($p in $PortsToTry) {
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $p)
        $listener.Start(); $listener.Stop()
        $backendPort = $p; break
    } catch {}
}

# Update frontend env to point to the chosen port
$envLocalPath = "$scriptDir\frontend\.env.local"
Set-Content $envLocalPath "NEXT_PUBLIC_API_BASE_URL=http://localhost:$backendPort"

# 1. Start Backend in a new window
Write-Host "`n[1/2] Starting FastAPI Backend on http://localhost:$backendPort ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir\backend'; .venv\Scripts\activate; uvicorn app.main:app --reload --port $backendPort"

# 2. Wait 4 seconds for backend to initialize
Start-Sleep -Seconds 4

# 3. Start Frontend in a new window
Write-Host "[2/2] Starting Next.js Frontend on http://localhost:3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir\frontend'; npm run dev"

Write-Host "`nBoth services are launching in dedicated windows!" -ForegroundColor Yellow
Write-Host "Open your browser at:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend API docs at:   http://localhost:$backendPort/docs" -ForegroundColor Cyan
