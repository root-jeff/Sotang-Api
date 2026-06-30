#!/usr/bin/env bash
# Run from sotang-api root: bash scripts/dev-setup.sh
set -e

echo "🐳 Starting Docker containers..."
docker compose up -d

echo "⏳ Waiting for Postgres to be ready..."
until docker exec sotang-postgres pg_isready -U sotang -d sotang_db > /dev/null 2>&1; do
  sleep 1
done
echo "✅ Postgres ready"

echo "⏳ Waiting for Redis..."
until docker exec sotang-redis redis-cli ping > /dev/null 2>&1; do
  sleep 1
done
echo "✅ Redis ready"

echo "📦 Installing dependencies..."
npm install

echo "🗄️  Generating Drizzle migration..."
npm run db:generate

echo "🚀 Running migrations..."
npm run db:migrate

echo ""
echo "✅ Setup complete! Run: npm run dev"
