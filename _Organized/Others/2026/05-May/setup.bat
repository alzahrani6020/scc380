@echo off
chcp 65001 >nul
title SCC - Smart Command Center Setup
color 0A

echo ╔═══════════════════════════════════════════════════════════════╗
echo ║         Smart Command Center - مركز القيادة الذكي            ║
echo ║                    Setup Script v1.0                          ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

REM Check Node.js
echo [1/8] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found! Please install Node.js 20+
    pause
    exit /b 1
)
echo ✅ Node.js found
echo.

REM Check pnpm
echo [2/8] Checking pnpm...
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo 📦 Installing pnpm...
    npm install -g pnpm
)
echo ✅ pnpm ready
echo.

REM Check Docker
echo [3/8] Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker not found! Please install Docker Desktop
    pause
    exit /b 1
)
echo ✅ Docker found
echo.

REM Install dependencies
echo [4/8] Installing dependencies...
call pnpm install
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed
echo.

REM Setup environment
echo [5/8] Setting up environment...
if not exist .env (
    copy .env.example .env
    echo ✅ .env file created
) else (
    echo ℹ️ .env already exists
)
echo.

REM Generate Prisma
echo [6/8] Generating Prisma client...
call pnpm db:generate
echo ✅ Prisma client generated
echo.

REM Start Docker infrastructure
echo [7/8] Starting Docker infrastructure...
docker compose -f infrastructure\docker\dev\docker-compose.yml up -d
if errorlevel 1 (
    echo ❌ Failed to start Docker containers
    pause
    exit /b 1
)
echo ✅ Infrastructure containers started
echo.

REM Wait for PostgreSQL
echo ⏳ Waiting for PostgreSQL to be ready...
timeout /t 5 /nobreak >nul

REM Run migrations
echo [8/8] Running database migrations...
call pnpm db:migrate
echo ✅ Database migrations completed
echo.

echo ╔═══════════════════════════════════════════════════════════════╗
echo ║              ✅ Setup Completed Successfully!                  ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
echo 🚀 To start development, run:
echo    pnpm dev
echo.
echo 🌐 Services will be available at:
echo    Web:      http://localhost:3000
echo    API:      http://localhost:3001
echo    Admin:    http://localhost:3002
echo    AI:       http://localhost:3003
echo    Keycloak: http://localhost:8080
echo.
pause
