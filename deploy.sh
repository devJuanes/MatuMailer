#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")" && pwd)}"
cd "$APP_DIR"

echo ">>> git pull"
git pull origin main

echo ">>> npm install"
npm install

echo ">>> dashboard .env.production"
cat > apps/dashboard/.env.production << 'EOF'
NEXT_PUBLIC_API_URL=https://matumailer.matubyte.com
NEXT_PUBLIC_APP_URL=https://matumailer.matubyte.com
EOF

echo ">>> migraciones"
npm run db:migrate:subscriptions --workspace=@matumailer/database || true
npm run db:migrate:pending-signups --workspace=@matumailer/database || true

echo ">>> build"
npm run build

echo ">>> pm2 restart"
pm2 restart matumailer-api matumailer-dashboard || pm2 start ecosystem.config.cjs

pm2 save
echo ">>> health"
sleep 2
curl -sS http://127.0.0.1:4001/health
echo ""
echo "✓ Deploy listo"
