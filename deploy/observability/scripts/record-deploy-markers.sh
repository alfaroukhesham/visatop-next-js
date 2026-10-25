#!/usr/bin/env bash
# Called from .github/workflows/deploy.yml after a successful blue-green deploy.
# Posts a Grafana annotation and creates a GlitchTip (Sentry-compatible) release
# via the local APIs. Skips cleanly when the stack or tokens are missing.
# Usage: record-deploy-markers.sh <staging|production> <gitsha>
set -u

ENV_NAME="${1:-}"
SHA="${2:-}"
OBS_ENV="${OBS_ENV_FILE:-/root/visatop/deploy/observability/.env}"

log() { printf 'markers: %s\n' "$*"; }

if [[ -z "$ENV_NAME" || -z "$SHA" ]]; then
  log "skip (need environment and sha)"
  exit 0
fi

if [[ -f "$OBS_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$OBS_ENV"
  set +a
fi

GRAFANA_URL="${GRAFANA_URL:-http://127.0.0.1:3030}"
GLITCHTIP_URL="${GLITCHTIP_URL:-http://127.0.0.1:3040}"
GF_USER="${GF_SECURITY_ADMIN_USER:-admin}"
GF_PASS="${GF_SECURITY_ADMIN_PASSWORD:-}"
GT_TOKEN="${GLITCHTIP_AUTH_TOKEN:-}"
GT_ORG="${GLITCHTIP_ORG_SLUG:-visatop}"
GT_PROJECT="${GLITCHTIP_PROJECT_SLUG:-visatop-next}"
VERSION="sha-${SHA}"
TEXT="Deploy ${VERSION} to ${ENV_NAME}"

if [[ -n "$GF_PASS" ]] && curl -fsS --max-time 5 -o /dev/null "$GRAFANA_URL/api/health" 2>/dev/null; then
  if curl -fsS --max-time 15 \
    -u "${GF_USER}:${GF_PASS}" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":$(printf '%s' "$TEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),\"tags\":[\"deploy\",\"${ENV_NAME}\"]}" \
    "${GRAFANA_URL}/api/annotations" >/dev/null; then
    log "grafana annotation posted"
  else
    log "grafana annotation skipped (auth or API error)"
  fi
else
  log "grafana annotation skipped (stack down or password unset)"
fi

if [[ -n "$GT_TOKEN" ]] && curl -fsS --max-time 5 -o /dev/null "$GLITCHTIP_URL/" 2>/dev/null; then
  payload=$(python3 - "$VERSION" "$GT_PROJECT" <<'PY'
import json, sys
print(json.dumps({"version": sys.argv[1], "projects": [sys.argv[2]]}))
PY
)
  if curl -fsS --max-time 15 \
    -H "Authorization: Bearer ${GT_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "$payload" \
    "${GLITCHTIP_URL}/api/0/organizations/${GT_ORG}/releases/" >/dev/null; then
    log "glitchtip release ${VERSION} created"
  else
    log "glitchtip release skipped (auth or API error)"
  fi
else
  log "glitchtip release skipped (stack down or GLITCHTIP_AUTH_TOKEN unset)"
fi

exit 0
