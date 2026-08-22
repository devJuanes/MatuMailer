#!/usr/bin/env bash
# Configura Postfix para recepción MatuMailer + HELO outbound coherente.
# Ejecutar como root en el VPS una vez (deploy.sh lo invoca).
set -euo pipefail

APP_DIR="${APP_DIR:-/root/apps/MatuMailer}"
WRAPPER="$APP_DIR/scripts/inbound-postfix-pipe.sh"
ENV_FILE="$APP_DIR/.env"

MAIL_HOST="${MATUMAILER_MAIL_HOST:-matumailer.matubyte.com}"
if [[ -f "$ENV_FILE" ]]; then
  _mh=$(grep -E '^MATUMAILER_MAIL_HOST=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r"' || true)
  [[ -n "$_mh" ]] && MAIL_HOST="$_mh"
fi

if [[ ! -f "$WRAPPER" ]]; then
  echo "No existe $WRAPPER — haz git pull primero"
  exit 1
fi

chmod +x "$WRAPPER"
chmod +x "$APP_DIR/scripts/setup-postfix-inbound.sh" || true

echo ">>> Hostname SMTP: $MAIL_HOST"

# ── Outbound / HELO (entregabilidad) ───────────────────────────────────────
postconf -e "myhostname = $MAIL_HOST"
postconf -e "mydomain = ${MAIL_HOST#*.}"
postconf -e "myorigin = \$mydomain"
# Recibir en todas las interfaces (puerto 25)
postconf -e "inet_interfaces = all"
postconf -e "inet_protocols = ipv4"
# No reenviar como open relay
postconf -e "smtpd_relay_restrictions = permit_mynetworks, reject_unauth_destination"
postconf -e "mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128"

# ── Inbound virtual domains ─────────────────────────────────────────────────
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
postconf -e "virtual_mailbox_limit = 0"

touch /etc/postfix/matumailer_domains /etc/postfix/matumailer_mailboxes
postmap /etc/postfix/matumailer_domains
postmap /etc/postfix/matumailer_mailboxes

cd "$APP_DIR"
grep -q '^POSTFIX_INBOUND_SYNC=' .env 2>/dev/null || echo 'POSTFIX_INBOUND_SYNC=1' >> .env
grep -q '^INBOUND_API_URL=' .env 2>/dev/null || echo "INBOUND_API_URL=https://matumailer.matubyte.com/api/inbound/ingest" >> .env
grep -q '^MATUMAILER_HELO_HOST=' .env 2>/dev/null || echo "MATUMAILER_HELO_HOST=$MAIL_HOST" >> .env

node scripts/sync-postfix-inbound.mjs

postfix reload || systemctl reload postfix || true

echo ""
echo "✓ Postfix configurado"
echo "  myhostname=$MAIL_HOST"
echo "  Recepción: MX → este servidor :25 → matumailer_mailboxes → pipe → API"
echo ""
echo "Verifica un buzón:"
echo "  node scripts/check-inbound-recipient.mjs agenda@tudominio.com"
echo ""
echo "PTR/rDNS: la IP pública debe resolver a un hostname coherente con $MAIL_HOST"
