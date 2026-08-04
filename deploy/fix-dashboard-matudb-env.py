#!/usr/bin/env python3
"""Hotfix: escribe NEXT_PUBLIC_MATUDB_* en dashboard y rebuild."""
import os
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

if not PASSWORD:
    print("ERROR: define SSH_PASS", file=sys.stderr)
    sys.exit(1)

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def run(client, cmd, timeout=1200):
    print(f"\n>>> {cmd[:200]}{'…' if len(cmd) > 200 else ''}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print("STDERR:", err.rstrip())
    if code != 0:
        raise RuntimeError(f"Command failed ({code})")
    return out


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    # Ensure production MatuDB project matches known MatuMailer tenant if missing
    run(
        client,
        f"""
set -e
cd {APP_DIR}
# Sync NEXT_PUBLIC from MATUDB if missing in root .env
grep -q '^NEXT_PUBLIC_MATUDB_URL=' .env || echo "NEXT_PUBLIC_MATUDB_URL=$(grep -E '^MATUDB_URL=' .env | head -1 | cut -d= -f2-)" >> .env
grep -q '^NEXT_PUBLIC_MATUDB_PROJECT_ID=' .env || echo "NEXT_PUBLIC_MATUDB_PROJECT_ID=$(grep -E '^MATUDB_PROJECT_ID=' .env | head -1 | cut -d= -f2-)" >> .env
grep -q '^NEXT_PUBLIC_MATUDB_API_KEY=' .env || echo "NEXT_PUBLIC_MATUDB_API_KEY=$(grep -E '^MATUDB_API_KEY=' .env | head -1 | cut -d= -f2-)" >> .env

URL=$(grep -E '^NEXT_PUBLIC_MATUDB_URL=' .env | head -1 | cut -d= -f2- | tr -d '\\r')
PID=$(grep -E '^NEXT_PUBLIC_MATUDB_PROJECT_ID=' .env | head -1 | cut -d= -f2- | tr -d '\\r')
KEY=$(grep -E '^NEXT_PUBLIC_MATUDB_API_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\\r')
[ -n "$URL" ] && [ -n "$PID" ] && [ -n "$KEY" ]

cat > apps/dashboard/.env.production << EOF
NEXT_PUBLIC_API_URL={SITE_URL}
NEXT_PUBLIC_APP_URL={SITE_URL}
NEXT_PUBLIC_MATUDB_URL=$URL
NEXT_PUBLIC_MATUDB_PROJECT_ID=$PID
NEXT_PUBLIC_MATUDB_API_KEY=$KEY
EOF
echo "project=$PID"
wc -l apps/dashboard/.env.production
""",
    )

    run(
        client,
        f"cd {APP_DIR} && npm run build --workspace=@matumailer/dashboard",
        timeout=1200,
    )
    run(client, "pm2 restart matumailer-dashboard")
    run(client, "sleep 5 && curl -sS -m 15 -I http://127.0.0.1:3015 | head -5")
    client.close()
    print(f"\n✓ Login MatuDB vars fijadas en {SITE_URL}")


if __name__ == "__main__":
    main()
