@echo off
setlocal enabledelayedexpansion

echo ===============================================
echo        AI-Gov Frontend Automated Setup         
echo ===============================================
echo.

echo [1/3] Navigating to Frontend Directory...
cd frontend
if not exist "package.json" (
    echo [X] Error: Could not find frontend directory or package.json
    pause
    exit /b 1
)
echo [v] Directory found.
echo.

echo [2/3] Setting up Environment Variables...
copy .env.example .env >nul
powershell -Command "(gc .env) -replace '^VITE_API_URL=.*', 'VITE_API_URL=http://localhost:3000/api/v1' | Out-File -encoding ASCII .env"
echo [v] Copied .env.example to .env and configured VITE_API_URL.
echo.

echo [3/3] Installing dependencies and starting UI...
call npm install
echo [v] Dependencies installed.
echo.

echo 🚀 Starting Frontend Development Server...
call npm run dev
pause
