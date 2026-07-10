#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "Stopping old servers on ports 3001 and 5173..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 1

echo "Starting Thread to PDF (server + web)..."
pnpm dev
