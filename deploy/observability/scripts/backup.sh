#!/usr/bin/env bash
# Snapshot observability volumes to DEST (default /root/visatop/backups/obs).
# Does not include Neon. GlitchTip postgres is local-only.
set -euo pipefail

DEST="${1:-/root/visatop/backups/obs}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$DEST"

backup_volume() {
  local volume="$1"
  local file="${DEST}/${volume}-${STAMP}.tar.gz"
  if ! docker volume inspect "$volume" >/dev/null 2>&1; then
    printf 'skip missing volume %s\n' "$volume"
    return 0
  fi
  printf '==> %s\n' "$volume"
  docker run --rm \
    -v "${volume}:/data:ro" \
    -v "${DEST}:/backup" \
    alpine:3.20 \
    tar czf "/backup/$(basename "$file")" -C /data .
}

backup_volume visatop-obs_prometheus-data
backup_volume visatop-obs_loki-data
backup_volume visatop-obs_tempo-data
backup_volume visatop-obs_grafana-data
backup_volume visatop-obs_glitchtip-pg-data
backup_volume visatop-obs_kuma-data

# Compose project name "visatop-obs" prefixes volumes. Plain names if project differs.
backup_volume prometheus-data
backup_volume loki-data
backup_volume tempo-data
backup_volume grafana-data
backup_volume glitchtip-pg-data
backup_volume kuma-data

printf '==> backups in %s\n' "$DEST"
printf 'keep 7-14 days of tarballs; this is not a substitute for droplet snapshots.\n'
