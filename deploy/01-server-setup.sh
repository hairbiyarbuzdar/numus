#!/usr/bin/env bash
#
# 01-server-setup.sh — one-time VPS provisioning for Numu
# Run this ONCE on a fresh Ubuntu/Debian VPS as root (or with sudo).
#
#   ssh root@72.61.118.49
#   bash 01-server-setup.sh
#
# Installs: Node 20 LTS, PostgreSQL, PM2, Nginx, Certbot, UFW firewall.
# Creates:  the 'numu' database + database user, and prints its password.
# ------------------------------------------------------------------------------
set -euo pipefail

# ─── EDIT THESE ───────────────────────────────────────────────────────────────
DB_NAME="numu"
DB_USER="numu"
# A strong DB password is generated automatically below. Override here if you want.
DB_PASSWORD="$(openssl rand -hex 24)"
# ──────────────────────────────────────────────────────────────────────────────

echo "==> Updating system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> Installing base tools"
apt-get install -y curl git ufw ca-certificates gnupg

echo "==> Installing Node.js 20 LTS (NodeSource)"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "    node $(node -v) / npm $(npm -v)"

echo "==> Installing PM2 (process manager) globally"
npm install -g pm2

echo "==> Installing PostgreSQL"
apt-get install -y postgresql postgresql-contrib
systemctl enable --now postgresql

echo "==> Creating database + user (idempotent)"
sudo -u postgres psql <<SQL
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
      CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
   ELSE
      ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
   END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

echo "==> Installing Nginx + Certbot"
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable --now nginx

echo "==> Configuring firewall (UFW)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "================================================================"
echo " ✅  Server provisioning complete."
echo "================================================================"
echo " PostgreSQL database : ${DB_NAME}"
echo " PostgreSQL user     : ${DB_USER}"
echo " PostgreSQL password : ${DB_PASSWORD}"
echo ""
echo " >>> COPY THE PASSWORD ABOVE into backend/.env (DB_PASSWORD) <<<"
echo "================================================================"
