#!/bin/sh
set -eu

PUBLIC_PORT="${PORT:-8080}"
export HOSTNAME=127.0.0.1
PORT=3000 node server.js &
export PORT="$PUBLIC_PORT"
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
wait
