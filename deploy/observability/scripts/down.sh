#!/usr/bin/env bash
# Stop the observability stack. Leaves named volumes in place.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
docker compose --profile core --profile full --profile errors --profile uptime --profile caddy-metrics down
printf '==> stopped. volumes kept (prometheus-data loki-data tempo-data grafana-data glitchtip-pg-data kuma-data)\n'
