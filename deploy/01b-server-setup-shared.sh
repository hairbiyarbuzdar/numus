#!/usr/bin/env bash
#
# 01b-server-setup-shared.sh — provisioning for numu on a SHARED VPS that
# already hosts other sites (Node/PM2/Nginx/PostgreSQL/Certbot already
# installed and serving other production traffic).
#
# Unlike 01-server-setup.sh (for a fresh, dedicated box), this script:
#   - does NOT install/upgrade Node, PM2, Nginx, Certbot, or PostgreSQL
#   - does NOT touch UFW rules
#   - does NOT remove /etc/nginx/sites-enabled/default
#   - ONLY creates the 'numu' database + database user, after checking
#     neither already exists (idempotent, but will refuse to clobber an
#     existing 'numu' DB/user that isn't ours)
#
# Run once, as root:
#   ssh root@72.62.126.88
#   bash 01b-server-setup-shared.sh
# ------------------------------------------------------------------------------
set -euo pipefail

DB_NAME="numu"
DB_USER="numu"
DB_PASSWORD="$(openssl rand -hex 24)"

echo "==> Sanity-checking required tools are already present"
for bin in node npm pm2 nginx psql certbot; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "!! '$bin' not found on this box. This script assumes it's already installed."
    echo "   Install it manually first, or use 01-server-setup.sh on a fresh box instead."
    exit 1
  fi
done
echo "    node $(node -v) / npm $(npm -v) / pm2 $(pm2 -v)"

echo "==> Checking for an existing '${DB_NAME}' database (won't overwrite)"
EXISTING_DB="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")"
if [ "$EXISTING_DB" = "1" ]; then
  echo "!! Database '${DB_NAME}' already exists on this box."
  echo "   Refusing to touch it automatically — verify by hand whether it's"
  echo "   already numu's DB (safe to reuse) or belongs to something else"
  echo "   (in which case pick a different DB_NAME/DB_USER in this script)."
  exit 1
fi

echo "==> Creating database + user"
sudo -u postgres psql <<SQL
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
      CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
   ELSE
      RAISE EXCEPTION 'Role ${DB_USER} already exists — pick a different DB_USER in this script.';
   END IF;
END
\$\$;
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

echo ""
echo "================================================================"
echo " ✅  Shared-box provisioning complete (numu DB only)."
echo "================================================================"
echo " PostgreSQL database : ${DB_NAME}"
echo " PostgreSQL user     : ${DB_USER}"
echo " PostgreSQL password : ${DB_PASSWORD}"
echo ""
echo " >>> COPY THE PASSWORD ABOVE into backend/.env (DB_PASSWORD) <<<"
echo ""
echo " Reminder: this box is shared. numu uses ports 4100 (backend) and"
echo " 4101 (frontend) — see deploy/ecosystem.config.js — to avoid the"
echo " ports already in use by other sites (3000-3003, 3007, 3010, 3011,"
echo " 3014, 3019-3022, 3030, 5050, 5051 were taken at last check)."
echo "================================================================"
