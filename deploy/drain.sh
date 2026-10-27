#!/usr/bin/env bash
#
# Drains the job queue: pushes new stamp counts out to Google and (later)
# Apple. Meant to be run every minute by cron.
#
# Install once, on the server:
#   chmod +x ~/wallet-loyalty/deploy/drain.sh
#   ( crontab -l 2>/dev/null | grep -v repio-drain
#     echo '* * * * * /home/ipreprunner/wallet-loyalty/deploy/drain.sh 2>&1 | /usr/bin/logger -t repio-drain'
#   ) | crontab -
#
# Check it afterwards with:
#   crontab -l
#   journalctl -t repio-drain --since '10 min ago'
#
# The secret is read from .env rather than written into the crontab, because a
# crontab is not the place to keep one.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

# Straight to the app, not through nginx: this is a machine talking to itself
# and has no business crossing the public interface to do it.
curl -fsS --max-time 60 -X POST http://127.0.0.1:3002/api/jobs/drain \
  ${CRON_SECRET:+-H "Authorization: Bearer ${CRON_SECRET}"} \
  -o /dev/null
