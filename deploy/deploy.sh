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
# node_modules/.bin/next is a /bin/sh shim that pnpm generates, so pm2 would
# hand a shell script to node and get a syntax error on the first comment.
# Point it at the real JavaScript entry point instead.
NEXT_BIN="$APP_DIR/apps/web/node_modules/next/dist/bin/next"
[ -f "$NEXT_BIN" ] || { echo "  ERROR: $NEXT_BIN not found — did the install finish?"; exit 1; }

# A process left in "errored" keeps its old, broken start command on restart.
pm2 describe "$APP_NAME" >/dev/null 2>&1 && pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start "$NEXT_BIN" --name "$APP_NAME" --cwd "$APP_DIR/apps/web" \
  -- start --port "$PORT"
pm2 save

echo
echo "==> health check"
# Wait for it to answer rather than guessing at a sleep — a cold Next start on
# a small box takes longer than any fixed number you would pick.
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://127.0.0.1:$PORT/" || echo 000)
  [ "$CODE" = "200" ] && break
  sleep 2
done
echo "  localhost:$PORT → HTTP $CODE after ${i}x2s"
[ "$CODE" = "200" ] || { echo "  ---- last log lines ----"; pm2 logs "$APP_NAME" --lines 15 --nostream 2>/dev/null | tail -16; }
pm2 list | grep -E "$APP_NAME" || true
