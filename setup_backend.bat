@echo off
setlocal enabledelayedexpansion

echo ===============================================
echo        AI-Gov Backend Automated Setup          
echo ===============================================
echo.

echo [1/4] Starting PostgreSQL Docker Container...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Docker is not installed or not in PATH! Please install Docker to proceed.
    pause
    exit /b 1
)

docker run --name aigov-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aigov -p 5432:5432 -v aigov_data:/var/lib/postgresql/data -d postgres
echo [v] Docker container 'aigov-postgres' started on port 5432.
echo.

echo [2/4] Setting up Environment Variables...
cd backend
if not exist ".env.example" (
    echo [X] Error: Could not find backend directory or .env.example
    pause
    exit /b 1
)

copy .env.example .env >nul
echo [v] Copied .env.example to .env
echo.

echo === GROQ API KEY CONFIGURATION ===
echo The AI-Gov platform uses Groq's Llama-3.3-70B model to analyze and summarize proposals.
echo You can get a free API key at: https://console.groq.com/keys
echo If you don't provide a key, the platform will use a Mock AI Service.
set /p GROQ_KEY="Enter your GROQ_API_KEY (or press Enter to skip and use mock): "

if defined GROQ_KEY (
    powershell -Command "(gc .env) -replace '^GROQ_API_KEY=.*', 'GROQ_API_KEY=!GROQ_KEY!' | Out-File -encoding ASCII .env"
    echo [v] GROQ_API_KEY configured.
) else (
    echo [!] Skipped GROQ API Key. Using Mock AI Service.
)

powershell -Command "(gc .env) -replace '^DATABASE_URL=.*', 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aigov' | Out-File -encoding ASCII .env"
echo.

echo [3/4] Installing dependencies and syncing database...
call npm install
call npx drizzle-kit push --force
call npm run db:seed
echo [v] Database seeded successfully.
echo.

echo [4/4] Starting Backend Server...
call npm run dev
pause
