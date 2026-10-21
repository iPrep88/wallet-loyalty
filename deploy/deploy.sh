#!/usr/bin/env bash
# Deploy the current main branch. Run ON THE SERVER:
#   bash ~/wallet-loyalty/deploy/deploy.sh
set -euo pipefail

APP_DIR="$HOME/wallet-loyalty"
APP_NAME="wallet-loyalty"
PORT=3002

cd "$APP_DIR"

echo "==> pulling"
git pull --ff-only origin main

echo "==> installing"
pnpm install --frozen-lockfile

echo "==> migrating the database"
set -a; . ./.env; set +a
pnpm db:migrate

echo "==> building"
pnpm --filter @wl/web build

echo "==> restarting"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  # Run the next binary directly rather than through pnpm: one process for pm2
  # to supervise, instead of a wrapper that forks the thing doing the work.
  pm2 start "$APP_DIR/apps/web/node_modules/.bin/next" \
    --name "$APP_NAME" --cwd "$APP_DIR/apps/web" \
    -- start --port "$PORT"
fi
pm2 save

sleep 3
echo
echo "==> health check"
curl -s -o /dev/null -w "  localhost:$PORT → HTTP %{http_code}\n" "http://127.0.0.1:$PORT/"
pm2 list | grep -E "$APP_NAME" || true
