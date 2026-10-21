#!/usr/bin/env bash
# One-time server setup for wallet-loyalty. Safe to re-run.
#
# Creates the database inside the Postgres container that is already on the
# box, installs pnpm, and writes the server's .env with generated secrets.
# Run it ON THE SERVER:  bash ~/wallet-loyalty/deploy/provision.sh
set -euo pipefail

APP_DIR="$HOME/wallet-loyalty"
PG_CONTAINER="iprep-postgres"
DB_NAME="wallet_loyalty"
DB_USER="wallet_user"
PORT=3002
DOMAIN="loyalty.iprep.ca"

echo "==> pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  sudo npm install -g pnpm >/dev/null
  echo "    installed $(pnpm -v)"
else
  echo "    already present ($(pnpm -v))"
fi

echo "==> database"
# The admin credentials of the existing container, read on the box only.
PG_ADMIN_USER=$(docker inspect "$PG_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_USER=//p')
PG_ADMIN_PW=$(docker inspect "$PG_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')

psql_admin() {
  docker exec -e PGPASSWORD="$PG_ADMIN_PW" "$PG_CONTAINER" \
    psql -U "$PG_ADMIN_USER" -d postgres -tAc "$1"
}

if [ "$(psql_admin "select 1 from pg_database where datname='$DB_NAME'")" = "1" ]; then
  echo "    database $DB_NAME already exists — leaving it alone"
  DB_PW="" # existing password stays in .env
else
  DB_PW=$(openssl rand -hex 24)   # hex only: no symbols to break a URL
  psql_admin "create role $DB_USER login password '$DB_PW'" >/dev/null
  psql_admin "create database $DB_NAME owner $DB_USER" >/dev/null
  echo "    created database $DB_NAME and role $DB_USER"
fi

echo "==> .env"
ENV_FILE="$APP_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  echo "    $ENV_FILE already exists — not overwriting"
else
  [ -n "$DB_PW" ] || { echo "    ERROR: database exists but .env is missing."; \
    echo "    Reset it: docker exec $PG_CONTAINER psql -U $PG_ADMIN_USER -c \"alter role $DB_USER password '<new>'\""; exit 1; }
  umask 077
  cat > "$ENV_FILE" <<ENVEOF
NEXT_PUBLIC_APP_URL=https://$DOMAIN
PORT=$PORT

# Postgres on this machine only — the container is bound to 127.0.0.1.
DATABASE_URL=postgresql://$DB_USER:$DB_PW@127.0.0.1:5432/$DB_NAME

# Signs the QR on every card. Changing it invalidates every card already
# issued, so treat it as permanent once real cards exist.
QR_TOKEN_SECRET=$(openssl rand -hex 32)

# Signs the staff scanner cookie. Safe to rotate (signs everyone out).
SESSION_SECRET=$(openssl rand -hex 32)

# Guards the queue worker endpoint.
CRON_SECRET=$(openssl rand -hex 16)

# Apple and Google are not configured yet — see packages/passes/src/.
ENVEOF
  echo "    written with generated secrets (not printed anywhere)"
fi

echo
echo "Done. Next: bash $APP_DIR/deploy/deploy.sh"
