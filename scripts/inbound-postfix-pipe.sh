#!/usr/bin/env bash
# Wrapper Postfix → carga secretos y ejecuta el pipe Node.
set -euo pipefail
APP_DIR="${APP_DIR:-/root/apps/MatuMailer}"
ENV_FILE="$APP_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^(INBOUND_WEBHOOK_SECRET|INBOUND_API_URL)=' "$ENV_FILE" || true)
  set +a
fi

export INBOUND_API_URL="${INBOUND_API_URL:-https://matumailer.matubyte.com/api/inbound/ingest}"

exec /usr/bin/node "$APP_DIR/scripts/inbound-postfix-pipe.mjs" "$@"
