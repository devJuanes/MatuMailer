#!/usr/bin/env bash
# Configura Postfix para recibir correo de aliases MatuMailer → pipe → API.
# Ejecutar como root en el servidor una vez.
set -euo pipefail

APP_DIR="${APP_DIR:-/root/apps/MatuMailer}"
WRAPPER="$APP_DIR/scripts/inbound-postfix-pipe.sh"
ENV_FILE="$APP_DIR/.env"

if [[ ! -f "$WRAPPER" ]]; then
  echo "No existe $WRAPPER — haz git pull primero"
  exit 1
fi

chmod +x "$WRAPPER"
chmod +x "$APP_DIR/scripts/setup-postfix-inbound.sh" || true

# master.cf — transporte pipe (bash wrapper carga INBOUND_WEBHOOK_SECRET)
if ! grep -q '^matumailer ' /etc/postfix/master.cf; then
  cat >> /etc/postfix/master.cf <<EOF

# MatuMailer inbound
matumailer unix - n n - - pipe
  flags=FR user=nobody argv=/bin/bash ${WRAPPER} \${recipient}
EOF
  echo "✓ master.cf: transporte matumailer añadido"
else
  echo "· master.cf ya tiene matumailer"
fi

postconf -e "virtual_mailbox_domains = hash:/etc/postfix/matumailer_domains"
postconf -e "virtual_mailbox_maps = hash:/etc/postfix/matumailer_mailboxes"
postconf -e "virtual_transport = matumailer:"
postconf -e "unknown_virtual_mailbox_reject_code = 550"

touch /etc/postfix/matumailer_domains /etc/postfix/matumailer_mailboxes
postmap /etc/postfix/matumailer_domains
postmap /etc/postfix/matumailer_mailboxes

cd "$APP_DIR"
grep -q '^POSTFIX_INBOUND_SYNC=' .env || echo 'POSTFIX_INBOUND_SYNC=1' >> .env
grep -q '^INBOUND_API_URL=' .env || echo 'INBOUND_API_URL=https://matumailer.matubyte.com/api/inbound/ingest' >> .env

node scripts/sync-postfix-inbound.mjs

echo "✓ Postfix inbound listo. MX de cada dominio debe apuntar a este servidor."
