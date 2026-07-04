#!/usr/bin/env bash
#
# 02-deploy.sh — install deps, run migrations, build, (re)start apps.
# Run from the repo root ON THE VPS, every time you deploy new code.
#
#   cd /var/www/numu
#   git pull          # if deploying via git
#   bash deploy/02-deploy.sh
#
# Prerequisites (one-time): 01-server-setup.sh has run, and BOTH env files exist:
#   - backend/.env         (from deploy/backend.env.production.example)
#   - .env.production       (from deploy/frontend.env.production.example)
# ------------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Checking env files exist"
[ -f backend/.env ]     || { echo "!! backend/.env missing — copy deploy/backend.env.production.example"; exit 1; }
[ -f .env.production ]  || { echo "!! .env.production missing — copy deploy/frontend.env.production.example"; exit 1; }

echo "==> Installing backend dependencies"
( cd backend && npm ci --omit=dev )

echo "==> Running database migrations"
( cd backend && npm run migrate && npm run migrate:email )

echo "==> Installing frontend dependencies"
npm ci

echo "==> Building Next.js frontend (bakes in NEXT_PUBLIC_API_BASE_URL)"
npm run build

echo "==> Starting / reloading apps under PM2"
if pm2 describe numu-backend >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.js
else
  pm2 start deploy/ecosystem.config.js
fi
pm2 save

echo ""
echo "✅  Deploy complete. Status:"
pm2 status
echo ""
echo "Logs:   pm2 logs"
echo "Health: curl -s http://localhost:4000/health"
