#!/bin/bash
set -e

echo "🚀 Setting up Smart Command Center..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
pnpm db:generate

# Start infrastructure
echo "🐳 Starting infrastructure containers..."
pnpm docker:up

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
sleep 5

# Run migrations
echo "🔄 Running database migrations..."
pnpm db:migrate

# Seed database
echo "🌱 Seeding database..."
cd packages/database && npx prisma db seed && cd ../..

echo "✅ Setup complete!"
echo ""
echo "🌐 Start development:"
echo "   pnpm dev"
echo ""
echo "📚 Services:"
echo "   Web:     http://localhost:3000"
echo "   API:     http://localhost:3001"
echo "   Admin:   http://localhost:3002"
echo "   AI:      http://localhost:3003"
echo "   Keycloak:http://localhost:8080"
