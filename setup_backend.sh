#!/bin/bash
# AI-Gov Backend Setup Script

echo "==============================================="
echo "       AI-Gov Backend Automated Setup          "
echo "==============================================="
echo ""

echo "[1/4] Starting PostgreSQL Docker Container..."
# Check if docker is running
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH! Please install Docker to proceed."
    exit 1
fi

docker run --name aigov-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aigov -p 5432:5432 -v aigov_data:/var/lib/postgresql/data -d postgres
echo "✅ Docker container 'aigov-postgres' started on port 5432."
echo ""

echo "[2/4] Setting up Environment Variables..."
cd backend || exit
if [ ! -f .env.example ]; then
    echo "❌ Error: Could not find backend directory or .env.example"
    exit 1
fi

cp .env.example .env
echo "✅ Copied .env.example to .env"

echo ""
echo "=== GROQ API KEY CONFIGURATION ==="
echo "The AI-Gov platform uses Groq's Llama-3.3-70B model to analyze and summarize proposals."
echo "You can get a free API key at: https://console.groq.com/keys"
echo "If you don't provide a key, the platform will use a Mock AI Service."
read -p "Enter your GROQ_API_KEY (or press Enter to skip and use mock): " GROQ_KEY

if [ -n "$GROQ_KEY" ]; then
    sed -i.bak "s|^GROQ_API_KEY=.*|GROQ_API_KEY=$GROQ_KEY|" .env && rm .env.bak
    echo "✅ GROQ_API_KEY configured."
else
    echo "⚠️  Skipped GROQ API Key. Using Mock AI Service."
fi

sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aigov|" .env && rm .env.bak
echo ""

echo "[3/4] Installing dependencies and syncing database..."
npm install
npx drizzle-kit push --force
npm run db:seed
echo "✅ Database seeded successfully."
echo ""

echo "[4/4] Starting Backend Server..."
npm run dev
