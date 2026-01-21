#!/bin/bash

set -e

echo "🚀 Starting Redis for benchmarks..."
docker-compose up -d

echo "⏳ Waiting for Redis to be ready..."
sleep 2

echo "📊 Running benchmarks..."
REDIS_URL=redis://localhost:6379 pnpm bench

echo "🛑 Stopping Redis..."
docker-compose down

echo "✅ Done!"
