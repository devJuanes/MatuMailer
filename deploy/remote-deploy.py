#!/usr/bin/env python3
"""Despliegue remoto MatuMailer vía SSH. Uso: SSH_PASS=... python deploy/remote-deploy.py"""
import os
import secrets
import sys

try:
    import paramiko
except ImportError:
    print("pip install paramiko", file=sys.stderr)
    sys.exit(1)

HOST = os.environ.get("DEPLOY_HOST", "13.140.160.248")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("SSH_PASS", "")
APP_DIR = "/root/apps/MatuMailer"
MATUOPS_DIR = "/root/apps/Matuops"
SITE_URL = "https://matumailer.matubyte.com"
API_URL = os.environ.get("API_URL", "https://api.matucatalogo.com")
PAY_API_KEY = "pk_matumailer_prod_cambiar"
MATUOPS_APP_TOKEN = os.environ.get(
    "MATUOPS_APP_TOKEN",
    "mapp_1fee879ae44149e63952ed8fd36bcdd352624072558b8740",
)
MATUOPS_ENDPOINT = os.environ.get("MATUOPS_ENDPOINT", "https://ops.matubyte.com")
APP_VERSION = os.environ.get("APP_VERSION", "1.0.0")

if not PASSWORD:
    print("ERROR: define SSH_PASS", file=sys.stderr)
    sys.exit(1)

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def run(client, cmd, timeout=900):
    print(f"\n>>> {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print("STDERR:", err.rstrip())
    if code != 0:
        raise RuntimeError(f"Command failed ({code}): {cmd}")
    return out


def ensure_env(client):
    """Crea .env en servidor si no existe (conserva el existente)."""
    check = run(client, f"test -f {APP_DIR}/.env && echo EXISTS || echo MISSING")
    if "EXISTS" in check:
        run(
            client,
            f"""grep -q '^CORS_ORIGIN=' {APP_DIR}/.env && sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN={SITE_URL}|' {APP_DIR}/.env || echo 'CORS_ORIGIN={SITE_URL}' >> {APP_DIR}/.env""",
        )
        run(
            client,
            f"""grep -q '^APP_URL=' {APP_DIR}/.env && sed -i 's|^APP_URL=.*|APP_URL={SITE_URL}|' {APP_DIR}/.env || echo 'APP_URL={SITE_URL}' >> {APP_DIR}/.env""",
        )
        run(
            client,
            f"""grep -q '^PAYMATUBYTE_URL=' {APP_DIR}/.env || echo 'PAYMATUBYTE_URL=https://pay.matubyte.com' >> {APP_DIR}/.env""",
        )
        run(
            client,
            f"""grep -q '^PAYMATUBYTE_API_KEY=' {APP_DIR}/.env && sed -i 's|^PAYMATUBYTE_API_KEY=.*|PAYMATUBYTE_API_KEY={PAY_API_KEY}|' {APP_DIR}/.env || echo 'PAYMATUBYTE_API_KEY={PAY_API_KEY}' >> {APP_DIR}/.env""",
        )
        run(
            client,
            f"""grep -q '^MATUOPS_APP_TOKEN=' {APP_DIR}/.env && sed -i 's|^MATUOPS_APP_TOKEN=.*|MATUOPS_APP_TOKEN={MATUOPS_APP_TOKEN}|' {APP_DIR}/.env || echo 'MATUOPS_APP_TOKEN={MATUOPS_APP_TOKEN}' >> {APP_DIR}/.env""",
        )
        run(
            client,
            f"""grep -q '^MATUOPS_ENDPOINT=' {APP_DIR}/.env && sed -i 's|^MATUOPS_ENDPOINT=.*|MATUOPS_ENDPOINT={MATUOPS_ENDPOINT}|' {APP_DIR}/.env || echo 'MATUOPS_ENDPOINT={MATUOPS_ENDPOINT}' >> {APP_DIR}/.env""",
        )
        run(
            client,
            f"""grep -q '^APP_VERSION=' {APP_DIR}/.env && sed -i 's|^APP_VERSION=.*|APP_VERSION={APP_VERSION}|' {APP_DIR}/.env || echo 'APP_VERSION={APP_VERSION}' >> {APP_DIR}/.env""",
        )
        return

    jwt = secrets.token_hex(32)
    enc = secrets.token_hex(16)
    env = f"""# MatuMailer — producción
PORT=4001
NODE_ENV=production
JWT_SECRET={jwt}
ENCRYPTION_KEY={enc}
CORS_ORIGIN={SITE_URL}
APP_URL={SITE_URL}

MATUDB_URL=https://db.matudb.com
MATUDB_PROJECT_ID=bb1be2d7-c478-4438-8f07-5aacd32528bc
MATUDB_API_KEY=mb_df7b594ecd6dfe106b92356c05a450cc6dd4b0990a7ff312b01308abdb8bc617

PAYMATUBYTE_URL=https://pay.matubyte.com
PAYMATUBYTE_API_KEY={PAY_API_KEY}

RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
SCHEDULER_INTERVAL_MS=30000

MATUOPS_APP_TOKEN={MATUOPS_APP_TOKEN}
MATUOPS_ENDPOINT={MATUOPS_ENDPOINT}
APP_VERSION={APP_VERSION}
"""
    sftp = client.open_sftp()
    with sftp.file(f"{APP_DIR}/.env", "w") as f:
        f.write(env)
    sftp.close()
    print("✓ .env creado en servidor")


def ensure_matuops_sdk(client):
    """Enlace simbólico matuops (minúsculas) y build del SDK para file:../matuops."""
    run(client, f"test -d {MATUOPS_DIR}/packages/app-sdk || (echo 'MatuOps no encontrado en {MATUOPS_DIR}' && exit 1)")
    run(client, "ln -sfn /root/apps/Matuops /root/apps/matuops")
    run(
        client,
        f"cd {MATUOPS_DIR}/packages/app-sdk && npm install && npm run build",
        timeout=300,
    )


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    run(client, f"cd {APP_DIR} && git fetch origin main && git reset --hard origin/main")
    ensure_matuops_sdk(client)
    run(client, f"cd {APP_DIR} && npm install")

    ensure_env(client)

    # Dashboard necesita NEXT_PUBLIC_MATUDB_* en build time (login/client)
    run(
        client,
        f"""
set -e
cd {APP_DIR}
MATUDB_URL=$(grep -E '^MATUDB_URL=' .env | head -1 | cut -d= -f2- | tr -d '\\r')
MATUDB_PROJECT_ID=$(grep -E '^MATUDB_PROJECT_ID=' .env | head -1 | cut -d= -f2- | tr -d '\\r')
MATUDB_API_KEY=$(grep -E '^MATUDB_API_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\\r')
# Prefer NEXT_PUBLIC_* already in root .env if present
NP_URL=$(grep -E '^NEXT_PUBLIC_MATUDB_URL=' .env | head -1 | cut -d= -f2- | tr -d '\\r' || true)
NP_PID=$(grep -E '^NEXT_PUBLIC_MATUDB_PROJECT_ID=' .env | head -1 | cut -d= -f2- | tr -d '\\r' || true)
NP_KEY=$(grep -E '^NEXT_PUBLIC_MATUDB_API_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\\r' || true)
URL=${{NP_URL:-$MATUDB_URL}}
PID=${{NP_PID:-$MATUDB_PROJECT_ID}}
KEY=${{NP_KEY:-$MATUDB_API_KEY}}
if [ -z "$URL" ] || [ -z "$PID" ] || [ -z "$KEY" ]; then
  echo "ERROR: faltan MATUDB_* en {APP_DIR}/.env" >&2
  exit 1
fi
cat > apps/dashboard/.env.production << EOF
NEXT_PUBLIC_API_URL={API_URL}
NEXT_PUBLIC_APP_URL={SITE_URL}
NEXT_PUBLIC_MATUDB_URL=$URL
NEXT_PUBLIC_MATUDB_PROJECT_ID=$PID
NEXT_PUBLIC_MATUDB_API_KEY=$KEY
EOF
echo "✓ apps/dashboard/.env.production escrito"
""",
    )

    run(client, f"cd {APP_DIR} && npm run db:migrate:subscriptions --workspace=@matumailer/database || true")
    run(
        client,
        f"cd {APP_DIR} && node packages/database/scripts/apply-messaging-upgrade.mjs || true",
        timeout=120,
    )
    run(client, f"cd {APP_DIR} && npm run build", timeout=1200)

    run(client, f"cd {APP_DIR} && pm2 delete matumailer-api matumailer-dashboard 2>/dev/null || true")
    run(client, f"cd {APP_DIR} && pm2 start ecosystem.config.cjs")
    run(client, "pm2 save")

    nginx_conf = f"{APP_DIR}/deploy/nginx/matumailer.matubyte.com.conf"
    run(client, f"test -f {nginx_conf}")
    run(
        client,
        f"cp {nginx_conf} /etc/nginx/sites-available/matumailer.matubyte.com && ln -sf /etc/nginx/sites-available/matumailer.matubyte.com /etc/nginx/sites-enabled/matumailer.matubyte.com",
    )

    cert = run(
        client,
        "test -f /etc/letsencrypt/live/matumailer.matubyte.com/fullchain.pem && echo HAS_SSL || echo NO_SSL",
    )
    if "NO_SSL" in cert:
        # HTTP-only nginx first for certbot
        run(
            client,
            """cat > /etc/nginx/sites-available/matumailer.matubyte.com << 'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name matumailer.matubyte.com;
    location / { return 200 'ok'; add_header Content-Type text/plain; }
}
NGINXEOF""",
        )
        run(client, "nginx -t && systemctl reload nginx")
        run(
            client,
            "certbot certonly --webroot -w /var/www/html -d matumailer.matubyte.com --non-interactive --agree-tos -m admin@matubyte.com 2>/dev/null || certbot certonly --nginx -d matumailer.matubyte.com --non-interactive --agree-tos -m admin@matubyte.com",
            timeout=300,
        )
        run(
            client,
            f"cp {nginx_conf} /etc/nginx/sites-available/matumailer.matubyte.com",
        )

    run(client, "nginx -t")
    run(client, "systemctl reload nginx")

    run(client, "sleep 8 && curl -sf -m 15 http://127.0.0.1:4001/health")
    run(client, "curl -sS -m 10 -I http://127.0.0.1:3015 | head -5")
    run(client, f"curl -sS -m 15 {SITE_URL}/health || curl -sS -m 15 http://matumailer.matubyte.com/health || true")

    client.close()
    print(f"\n✓ MatuMailer desplegado en {SITE_URL}")


if __name__ == "__main__":
    main()

