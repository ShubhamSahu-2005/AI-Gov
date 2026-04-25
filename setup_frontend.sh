#!/bin/bash
# AI-Gov Frontend Setup Script

echo "==============================================="
echo "       AI-Gov Frontend Automated Setup         "
echo "==============================================="
echo ""

echo "[1/3] Navigating to Frontend Directory..."
cd frontend || exit
if [ ! -f package.json ]; then
    echo "❌ Error: Could not find frontend directory or package.json"
    exit 1
fi
echo "✅ Directory found."
echo ""

echo "[2/3] Setting up Environment Variables..."
cp .env.example .env
sed -i.bak "s|^VITE_API_URL=.*|VITE_API_URL=http://localhost:3000/api/v1|" .env && rm .env.bak
echo "✅ Copied .env.example to .env and configured VITE_API_URL."
echo ""

echo "[3/3] Installing dependencies and starting UI..."
npm install
echo "✅ Dependencies installed."
echo ""
echo "🚀 Starting Frontend Development Server..."
npm run dev
