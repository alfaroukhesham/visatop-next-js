#!/usr/bin/env bash
# Start the opt-in observability stack. Does not run from deploy.yml.
# Usage: ./up.sh [core|full|errors|uptime]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROFILE="${1:-core}"
ENV_FILE="${ROOT}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'error: missing %s\n' "$ENV_FILE" >&2
  printf 'copy env.example, fill secrets, then re-run.\n' >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

need() {
  local key="$1"
  if [[ -z "${!key:-}" || "${!key}" == change-me* || "${!key}" == *REPLACE_ME* || "${!key}" == changeme ]]; then
    printf 'error: set %s in %s before starting\n' "$key" "$ENV_FILE" >&2
    exit 1
  fi
}

need GF_SECURITY_ADMIN_PASSWORD
if [[ "$PROFILE" == "full" || "$PROFILE" == "errors" ]]; then
  need GLITCHTIP_SECRET_KEY
  need GLITCHTIP_POSTGRES_PASSWORD
fi

if [[ "$PROFILE" == "full" || "$PROFILE" == "core" ]]; then
  need OBS_BASIC_AUTH_PASSWORD
  printf '==> hashing Caddy basic_auth password\n'
  OBS_BASIC_AUTH_HASH="$(
    docker run --rm caddy:2.9-alpine caddy hash-password --plaintext "$OBS_BASIC_AUTH_PASSWORD"
  )"
  export OBS_BASIC_AUTH_HASH
fi

if ! docker network inspect visatop_edge >/dev/null 2>&1; then
  printf '==> creating visatop_edge (app/Caddy network was missing)\n'
  docker network create visatop_edge >/dev/null
fi

PROFILES=(--profile "$PROFILE")
if [[ "$PROFILE" == "full" ]]; then
  PROFILES=(--profile full)
  if docker inspect visatop-edge-prod >/dev/null 2>&1 && docker inspect visatop-edge-staging >/dev/null 2>&1; then
    PROFILES+=(--profile caddy-metrics)
  else
    printf '==> skipping caddy-metrics; start visatop-edge-prod/staging first, then re-run with: docker compose --profile caddy-metrics up -d\n'
  fi
elif [[ "$PROFILE" == "core" ]]; then
  if docker inspect visatop-edge-prod >/dev/null 2>&1 && docker inspect visatop-edge-staging >/dev/null 2>&1; then
    PROFILES+=(--profile caddy-metrics)
  fi
fi

printf '==> starting visatop-obs profile=%s\n' "$PROFILE"
docker compose --env-file "$ENV_FILE" "${PROFILES[@]}" up -d

printf '\nUIs (SSH tunnel; never expose 0.0.0.0):\n'
printf '  Grafana     http://127.0.0.1:3030  (also Caddy http://127.0.0.1:3080)\n'
printf '  GlitchTip   http://127.0.0.1:3040  (profile errors|full)\n'
printf '  Uptime Kuma http://127.0.0.1:3050  (profile uptime|full)\n'
printf '  ssh -L 3030:127.0.0.1:3030 -L 3040:127.0.0.1:3040 -L 3050:127.0.0.1:3050 USER@DROPLET\n'
