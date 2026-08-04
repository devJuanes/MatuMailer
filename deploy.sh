#!/usr/bin/env bash
# deploy.sh — Actualiza MatuMailer en el VPS (git + build + PM2)
#
# Uso (en el servidor):
#   cd /root/apps/MatuMailer
#   bash deploy.sh
#
# Opciones:
#   --skip-pull     No hace git pull
#   --branch NAME   Rama a desplegar (default: main)
#   --no-migrate    Omite migraciones de MatuDB
#   --no-pm2        Solo build, no reinicia PM2
#   --help          Muestra esta ayuda
#
# Requisitos: .env en la raíz del repo, Node 20+, PM2, npm

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")" && pwd)}"
BRANCH="${DEPLOY_BRANCH:-main}"
DO_PULL=1
DO_MIGRATE=1
DO_PM2=1
SITE_URL="${SITE_URL:-https://matumailer.matubyte.com}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4001/health}"
DASHBOARD_PROBE="${DASHBOARD_PROBE:-http://127.0.0.1:3015}"

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-pull) DO_PULL=0; shift ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --no-migrate) DO_MIGRATE=0; shift ;;
    --no-pm2) DO_PM2=0; shift ;;
    --help|-h) usage ;;
    *)
      echo "Opción desconocida: $1" >&2
      usage
      ;;
  esac
done

cd "$APP_DIR"

log() { echo ""; echo ">>> $*"; }
ok() { echo "✓ $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

command -v node >/dev/null || die "Node.js no está instalado"
command -v npm >/dev/null || die "npm no está instalado"
[[ -f "$APP_DIR/.env" ]] || die "Falta $APP_DIR/.env — copia .env.example y rellénalo"

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  die "Se requiere Node.js >= 20 (actual: $(node -v))"
fi

log "Directorio: $APP_DIR"
log "Rama: $BRANCH"
log "Sitio: $SITE_URL"

# ── Git ─────────────────────────────────────────────────────────────────────
if [[ "$DO_PULL" -eq 1 ]]; then
  log "git fetch + reset a origin/$BRANCH"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  ok "Código actualizado ($(git rev-parse --short HEAD))"
else
  log "Omitiendo git pull (--skip-pull)"
fi

# ── Dependencias ────────────────────────────────────────────────────────────
log "npm install"
npm install
ok "Dependencias instaladas"

# ── Env dashboard (NEXT_PUBLIC_* en build time) ─────────────────────────────
log "Sincronizar apps/dashboard/.env.production desde .env raíz"
if [[ -f "$APP_DIR/scripts/sync-dashboard-env.mjs" ]]; then
  node scripts/sync-dashboard-env.mjs
else
  # Fallback si el script no existe
  MATUDB_URL=$(grep -E '^NEXT_PUBLIC_MATUDB_URL=' .env | head -1 | cut -d= -f2- | tr -d '\r' || true)
  [[ -z "$MATUDB_URL" ]] && MATUDB_URL=$(grep -E '^MATUDB_URL=' .env | head -1 | cut -d= -f2- | tr -d '\r' || true)
  MATUDB_PROJECT_ID=$(grep -E '^NEXT_PUBLIC_MATUDB_PROJECT_ID=' .env | head -1 | cut -d= -f2- | tr -d '\r' || true)
  [[ -z "$MATUDB_PROJECT_ID" ]] && MATUDB_PROJECT_ID=$(grep -E '^MATUDB_PROJECT_ID=' .env | head -1 | cut -d= -f2- | tr -d '\r' || true)
  MATUDB_API_KEY=$(grep -E '^NEXT_PUBLIC_MATUDB_API_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\r' || true)
  [[ -z "$MATUDB_API_KEY" ]] && MATUDB_API_KEY=$(grep -E '^MATUDB_API_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\r' || true)
  APP_URL=$(grep -E '^APP_URL=' .env | head -1 | cut -d= -f2- | tr -d '\r' || true)
  [[ -z "$APP_URL" ]] && APP_URL="$SITE_URL"

  [[ -n "$MATUDB_URL" && -n "$MATUDB_PROJECT_ID" && -n "$MATUDB_API_KEY" ]] \
    || die "Faltan MATUDB_* en .env"

  cat > apps/dashboard/.env.production << EOF
NEXT_PUBLIC_API_URL=$APP_URL
NEXT_PUBLIC_APP_URL=$APP_URL
NEXT_PUBLIC_MATUDB_URL=$MATUDB_URL
NEXT_PUBLIC_MATUDB_PROJECT_ID=$MATUDB_PROJECT_ID
NEXT_PUBLIC_MATUDB_API_KEY=$MATUDB_API_KEY
EOF
  ok "apps/dashboard/.env.production escrito (fallback)"
fi

# Asegura CORS_ORIGIN / APP_URL coherentes con producción
if ! grep -q '^CORS_ORIGIN=' .env; then
  echo "CORS_ORIGIN=$SITE_URL" >> .env
elif ! grep -q "^CORS_ORIGIN=$SITE_URL" .env; then
  log "Aviso: CORS_ORIGIN en .env no coincide con $SITE_URL — revisa manualmente"
fi

# ── Migraciones (best-effort) ───────────────────────────────────────────────
if [[ "$DO_MIGRATE" -eq 1 ]]; then
  log "Migraciones MatuDB (best-effort)"
  npm run db:migrate:subscriptions --workspace=@matumailer/database || true
  npm run db:migrate:pending-signups --workspace=@matumailer/database || true
  if [[ -f packages/database/scripts/apply-messaging-upgrade.mjs ]]; then
    node packages/database/scripts/apply-messaging-upgrade.mjs || true
  fi
  ok "Migraciones intentadas"
else
  log "Omitiendo migraciones (--no-migrate)"
fi

# ── Build ───────────────────────────────────────────────────────────────────
log "npm run build"
npm run build

[[ -f apps/api/dist/index.js ]] || die "No se generó apps/api/dist/index.js"
[[ -d apps/dashboard/.next ]] || die "No se generó apps/dashboard/.next"
ok "Build OK"

# ── PM2 ─────────────────────────────────────────────────────────────────────
if [[ "$DO_PM2" -eq 1 ]]; then
  command -v pm2 >/dev/null || die "PM2 no está instalado (npm i -g pm2)"

  log "Reiniciar PM2"
  if pm2 describe matumailer-api >/dev/null 2>&1; then
    pm2 restart matumailer-api matumailer-dashboard --update-env
  else
    pm2 start ecosystem.config.cjs
  fi
  pm2 save
  ok "PM2 actualizado"

  log "Health check"
  sleep 5
  if curl -sf -m 15 "$HEALTH_URL" >/dev/null; then
    curl -sS -m 15 "$HEALTH_URL" || true
    echo ""
    ok "API health OK ($HEALTH_URL)"
  else
    echo "Aviso: health falló en $HEALTH_URL — revisa: pm2 logs matumailer-api --lines 50" >&2
  fi

  curl -sS -m 10 -I "$DASHBOARD_PROBE" 2>/dev/null | head -5 || true
else
  log "Omitiendo PM2 (--no-pm2). Ejecuta: pm2 restart all"
fi

echo ""
echo "════════════════════════════════════════"
echo "  Deploy listo — $SITE_URL"
echo "  Commit: $(git rev-parse --short HEAD)"
echo "════════════════════════════════════════"
