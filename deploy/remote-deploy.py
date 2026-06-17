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
SITE_URL = "https://matumailer.matubyte.com"
PAY_API_KEY = "pk_matumailer_prod_cambiar"

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
"""
    sftp = client.open_sftp()
    with sftp.file(f"{APP_DIR}/.env", "w") as f:
        f.write(env)
    sftp.close()
    print("✓ .env creado en servidor")


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    run(client, f"cd {APP_DIR} && git pull origin main")
    run(client, f"cd {APP_DIR} && npm install")

    ensure_env(client)

    run(
        client,
        f"echo 'NEXT_PUBLIC_API_URL={SITE_URL}' > {APP_DIR}/apps/dashboard/.env.production",
    )

    run(client, f"cd {APP_DIR} && npm run db:migrate:subscriptions --workspace=@matumailer/database || true")
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

    run(client, "sleep 3 && curl -sS -m 10 http://127.0.0.1:4001/health")
    run(client, "curl -sS -m 10 -I http://127.0.0.1:3015 | head -5")
    run(client, f"curl -sS -m 15 {SITE_URL}/health || curl -sS -m 15 http://matumailer.matubyte.com/health || true")

    client.close()
    print(f"\n✓ MatuMailer desplegado en {SITE_URL}")


if __name__ == "__main__":
    main()

