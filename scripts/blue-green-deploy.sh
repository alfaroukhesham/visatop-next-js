#!/usr/bin/env bash
# Blue-green cutover for staging and production on this droplet.
# The Caddy proxy owns host ports 3000 (production) and 3001 (staging).
# App containers stay on the visatop_edge network and do not publish those ports.
# After the proxy flips, the previous slot is drained for 90 seconds.
set -euo pipefail

DRAIN_SECONDS=90
NETWORK=visatop_edge
EDGE_IP=159.65.20.33
CADDY_IMAGE=caddy:2-alpine
ROOT=/root/visatop
REPO="${ROOT}/dev"
STATE_DIR="${ROOT}/deploy/state"
CADDY_ROOT="${ROOT}/deploy/caddy"
WORKTREE_ROOT="${ROOT}/deploy/worktrees"
LOCK_FILE="${ROOT}/deploy/deploy.lock"

usage() {
  cat <<'EOF'
Usage:
  blue-green-deploy.sh bootstrap <staging|production>
  blue-green-deploy.sh deploy <staging|production> <image> [--skip-migrate]
  blue-green-deploy.sh rollback <staging|production>
  blue-green-deploy.sh status [staging|production]
  blue-green-deploy.sh check-db <staging|production>

deploy image tags must look like repo/name:sha-<git sha>. :latest is refused.
bootstrap moves the container that is already bound to the public port behind Caddy.
It does not migrate. The port handoff is a short gap; later deploys drain for 90s.
EOF
}

log() {
  printf '==> %s\n' "$*"
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

need_env() {
  case "${1:-}" in
    staging|production) ENV_NAME="$1" ;;
    *) die "environment must be staging or production" ;;
  esac
  case "$ENV_NAME" in
    production)
      SLOT_PREFIX=visatop-next
      HOST_PORT=3000
      ENV_FILE="${ROOT}/.env"
      HOST_NEEDLE=snowy-cake
      CADDY_NAME=visatop-edge-prod
      PUBLIC_URL=https://visatop.com/visa-processing
      LEGACY_NAME=visatop-next
      ;;
    staging)
      SLOT_PREFIX=visatop-next-demo
      HOST_PORT=3001
      ENV_FILE="${ROOT}/.env.staging"
      HOST_NEEDLE=weathered-resonance
      CADDY_NAME=visatop-edge-staging
      PUBLIC_URL=https://app-staging.visatop.com/visa-processing
      LEGACY_NAME=visatop-next-demo
      ;;
  esac
  BLUE="${SLOT_PREFIX}-blue"
  GREEN="${SLOT_PREFIX}-green"
  STATE_FILE="${STATE_DIR}/${ENV_NAME}.json"
  CADDY_DIR="${CADDY_ROOT}/${ENV_NAME}"
  CADDYFILE="${CADDY_DIR}/Caddyfile"
}

ensure_dirs() {
  mkdir -p "$STATE_DIR" "$CADDY_DIR" "$WORKTREE_ROOT"
  chmod 700 "$STATE_DIR" "$WORKTREE_ROOT"
}

ensure_network() {
  if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
    docker network create "$NETWORK" >/dev/null
  fi
}

lock() {
  ensure_dirs
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    die "another blue-green deploy is running"
  fi
}

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

container_running() {
  [[ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || echo false)" == "true" ]]
}

other_slot() {
  if [[ "$1" == "blue" ]]; then
    printf '%s\n' "$GREEN"
  else
    printf '%s\n' "$BLUE"
  fi
}

slot_color() {
  case "$1" in
    *-blue) printf 'blue\n' ;;
    *-green) printf 'green\n' ;;
    *) die "not a slot name: $1" ;;
  esac
}

write_state() {
  local slot="$1"
  local image="$2"
  python3 - "$STATE_FILE" "$ENV_NAME" "$slot" "$image" <<'PY'
import json, os, sys
from datetime import datetime, timezone
path, env, slot, image = sys.argv[1:]
data = {
    "environment": env,
    "active_slot": slot,
    "active_image": image,
    "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}
tmp = path + ".tmp"
with open(tmp, "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2)
    fh.write("\n")
os.chmod(tmp, 0o600)
os.replace(tmp, path)
PY
}

read_active_slot() {
  python3 - "$STATE_FILE" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
if not path.exists():
    raise SystemExit(1)
print(json.loads(path.read_text())["active_slot"])
PY
}

# Prints nothing on success. Exits non-zero with a host-needle error and never prints a URL.
check_db_hosts() {
  python3 - "$ENV_FILE" "$HOST_NEEDLE" "${ROOT}/.env" "${ROOT}/.env.staging" <<'PY'
import sys
from pathlib import Path
from urllib.parse import urlparse

env_file, needle, prod_file, staging_file = sys.argv[1:]

def load(path):
    vals = {}
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "'\"":
            val = val[1:-1]
        vals[key] = val
    return vals

def host_of(vals):
    url = vals.get("DATABASE_URL_DIRECT") or vals.get("DATABASE_URL") or ""
    host = urlparse(url).hostname or ""
    source = "DATABASE_URL_DIRECT" if vals.get("DATABASE_URL_DIRECT") else "DATABASE_URL"
    return host, source

def fail(msg):
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)

try:
    current = load(env_file)
    prod = load(prod_file)
    staging = load(staging_file)
except OSError:
    fail("database env file is missing")

host, source = host_of(current)
prod_host, _ = host_of(prod)
staging_host, _ = host_of(staging)
if not host:
    fail("database url is missing")
if needle not in host:
    fail(f"database host does not contain {needle}")
if prod_host and staging_host and prod_host == staging_host:
    fail("staging and production database hosts match")
print(f"database host ok ({needle}, {source})")
PY
}

load_migrate_env() {
  # shellcheck disable=SC1090
  eval "$(python3 - "$ENV_FILE" <<'PY'
import shlex, sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse

vals = {}
for raw in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, val = line.split("=", 1)
    key = key.strip()
    val = val.strip()
    if len(val) >= 2 and val[0] == val[-1] and val[0] in "'\"":
        val = val[1:-1]
    if key in {"DATABASE_URL", "DATABASE_URL_DIRECT"}:
        vals[key] = val

direct = vals.get("DATABASE_URL_DIRECT", "")
if not direct and vals.get("DATABASE_URL"):
    parts = urlparse(vals["DATABASE_URL"])
    host = parts.hostname or ""
    if "-pooler" in host:
        host = host.replace("-pooler", "", 1)
        netloc = host
        if parts.port:
            netloc = f"{host}:{parts.port}"
        if parts.username:
            auth = parts.username
            if parts.password:
                auth = f"{auth}:{parts.password}"
            netloc = f"{auth}@{netloc}"
        direct = urlunparse((parts.scheme, netloc, parts.path, parts.params, parts.query, parts.fragment))
    else:
        direct = vals["DATABASE_URL"]

if vals.get("DATABASE_URL"):
    print(f"export DATABASE_URL={shlex.quote(vals['DATABASE_URL'])}")
if direct:
    print(f"export DATABASE_URL_DIRECT={shlex.quote(direct)}")
PY
)"
}

assert_migrations() {
  local mode="$1"
  (
    cd "$WORKTREE"
    node --input-type=module - "$mode" <<'JS'
import fs from "node:fs";
import pg from "pg";

const mode = process.argv[2];
const journal = JSON.parse(fs.readFileSync("drizzle/meta/_journal.json", "utf8"));
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const { rows } = await client.query(
    "select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1",
  );
  const latest = rows[0] ? Number(rows[0].created_at) : 0;
  const pending = journal.entries.filter((entry) => Number(entry.when) > latest);
  console.log(`migrations latest=${latest} pending=${pending.length}`);
  if (mode === "assert-clear" && pending.length > 0) process.exit(2);
} catch (error) {
  const msg = String(error?.message || error).replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://***");
  console.error(msg);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
JS
  )
}

migrate_sha() {
  local sha="$1"
  log "fetching ${sha} for migrations"
  git -C "$REPO" fetch origin
  local full
  full="$(git -C "$REPO" rev-parse --verify "${sha}^{commit}")"
  WORKTREE="${WORKTREE_ROOT}/${full}"
  if [[ ! -d "$WORKTREE" ]]; then
    git -C "$REPO" worktree add --detach "$WORKTREE" "$full"
  fi
  log "installing migrate dependencies"
  (
    cd "$WORKTREE"
    CI=1 NODE_ENV=development pnpm install --frozen-lockfile
  )
  load_migrate_env
  if [[ -z "${DATABASE_URL_DIRECT:-}" ]]; then
    die "DATABASE_URL_DIRECT is missing"
  fi
  export DATABASE_URL DATABASE_URL_DIRECT
  assert_migrations list || die "could not read migration status"
  log "running drizzle-kit migrate"
  (
    cd "$WORKTREE"
    CI=1 pnpm exec drizzle-kit migrate
  )
  assert_migrations assert-clear || die "migrations are still pending after drizzle-kit migrate"
}

parse_sha_tag() {
  local image="$1"
  if [[ "$image" == *:latest ]]; then
    die "refusing :latest; tag the image sha-<gitsha>"
  fi
  if [[ ! "$image" =~ :sha-([0-9a-f]{7,40})$ ]]; then
    die "image tag must end with :sha-<gitsha>"
  fi
  printf '%s\n' "${BASH_REMATCH[1]}"
}

validate_image_ref() {
  [[ "$1" =~ ^[A-Za-z0-9._/:@-]+$ ]] || die "invalid image reference"
}

write_caddyfile() {
  local upstream="$1"
  local dest="$2"
  cat >"$dest" <<EOF
{
	auto_https off
	admin 127.0.0.1:2019
	servers {
		trusted_proxies static ${EDGE_IP}/32
	}
}

:${HOST_PORT} {
	reverse_proxy ${upstream}:3000 {
		header_up X-Forwarded-Proto {http.request.header.X-Forwarded-Proto}
		header_up X-Forwarded-Host {http.request.header.X-Forwarded-Host}
	}
}
EOF
}

validate_caddyfile() {
  local output
  if ! output="$(docker run --rm \
    -v "${1}:/etc/caddy/Caddyfile:ro" \
    "$CADDY_IMAGE" \
    caddy validate --config /etc/caddy/Caddyfile 2>&1)"; then
    printf '%s\n' "$output" >&2
    return 1
  fi
}

start_slot() {
  local name="$1"
  local image="$2"
  if container_exists "$name"; then
    if container_running "$name"; then
      die "refusing to replace running slot ${name}"
    fi
    docker rm "$name" >/dev/null
  fi
  log "starting ${name}"
  docker run -d \
    --name "$name" \
    --network "$NETWORK" \
    --env-file "$ENV_FILE" \
    --restart unless-stopped \
    "$image" >/dev/null
}

wait_healthy() {
  local name="$1"
  local i
  for i in $(seq 1 30); do
    if docker exec "$name" node --input-type=module -e '
      const paths = ["/visa-processing/api/health", "/visa-processing"];
      for (const path of paths) {
        try {
          const response = await fetch("http://127.0.0.1:3000" + path);
          if (response.status >= 200 && response.status < 400) process.exit(0);
        } catch {}
      }
      process.exit(1);
    ' >/dev/null 2>&1; then
      log "${name} is healthy"
      return 0
    fi
    sleep 2
  done
  docker logs --tail 60 "$name" >&2 || true
  return 1
}

http_code() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$1" || true
}

wait_url() {
  local url="$1"
  local i code
  for i in $(seq 1 20); do
    code="$(http_code "$url")"
    if [[ "$code" == "200" ]]; then
      log "${url} -> 200"
      return 0
    fi
    sleep 1
  done
  printf 'error: %s returned %s\n' "$url" "${code:-none}" >&2
  return 1
}

reload_caddy() {
  local upstream="$1"
  local next="${CADDYFILE}.next"
  local backup="${CADDYFILE}.bak"
  write_caddyfile "$upstream" "$next"
  validate_caddyfile "$next"
  if [[ -f "$CADDYFILE" ]]; then
    cp "$CADDYFILE" "$backup"
  fi
  mv "$next" "$CADDYFILE"
  if ! docker exec "$CADDY_NAME" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
    if [[ -f "$backup" ]]; then
      mv "$backup" "$CADDYFILE"
      docker exec "$CADDY_NAME" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
    fi
    return 1
  fi
}

start_caddy() {
  log "starting ${CADDY_NAME} on :${HOST_PORT}"
  docker run -d \
    --name "$CADDY_NAME" \
    --network "$NETWORK" \
    --restart unless-stopped \
    -p "${HOST_PORT}:${HOST_PORT}" \
    -v "${CADDY_DIR}:/etc/caddy:ro" \
    "$CADDY_IMAGE" >/dev/null
}

flip_to() {
  local upstream="$1"
  reload_caddy "$upstream" || return 1
  wait_url "http://127.0.0.1:${HOST_PORT}/visa-processing" || return 1
  wait_url "$PUBLIC_URL" || return 1
}

drain() {
  local name="$1"
  if ! container_exists "$name"; then
    return 0
  fi
  if ! container_running "$name"; then
    return 0
  fi
  log "draining ${name} for ${DRAIN_SECONDS}s"
  docker stop -t "$DRAIN_SECONDS" "$name" >/dev/null
}

remove_slot() {
  local name="$1"
  if container_exists "$name"; then
    docker rm -f "$name" >/dev/null || true
  fi
}

cmd_check_db() {
  need_env "$1"
  [[ -f "$ENV_FILE" ]] || die "missing ${ENV_FILE}"
  check_db_hosts
}

cmd_status() {
  local envs=()
  if [[ -n "${1:-}" ]]; then
    envs=("$1")
  else
    envs=(staging production)
  fi
  local env
  for env in "${envs[@]}"; do
    need_env "$env"
    local slot="none" image="none" proxy="down"
    if [[ -f "$STATE_FILE" ]]; then
      slot="$(read_active_slot)"
      image="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["active_image"])' "$STATE_FILE")"
    fi
    if container_running "$CADDY_NAME"; then
      proxy="up"
    fi
    printf '%s active=%s proxy=%s port=%s image=%s\n' "$ENV_NAME" "$slot" "$proxy" "$HOST_PORT" "$image"
    local color name
    for color in blue green; do
      name="${SLOT_PREFIX}-${color}"
      if ! container_exists "$name"; then
        printf '  %s absent\n' "$name"
      elif container_running "$name"; then
        printf '  %s running\n' "$name"
      else
        printf '  %s stopped\n' "$name"
      fi
    done
  done
}

cmd_bootstrap() {
  need_env "$1"
  lock
  [[ -f "$ENV_FILE" ]] || die "missing ${ENV_FILE}"
  check_db_hosts
  container_exists "$LEGACY_NAME" || die "legacy container ${LEGACY_NAME} is not present"
  container_running "$LEGACY_NAME" || die "legacy container ${LEGACY_NAME} is not running"
  if container_exists "$CADDY_NAME"; then
    die "${CADDY_NAME} already exists"
  fi
  if container_exists "$BLUE" || container_exists "$GREEN"; then
    die "a slot container already exists"
  fi
  ensure_network
  log "pulling ${CADDY_IMAGE}"
  docker pull "$CADDY_IMAGE" >/dev/null
  local image
  image="$(docker inspect -f '{{.Image}}' "$LEGACY_NAME")"
  start_slot "$BLUE" "$image"
  if ! wait_healthy "$BLUE"; then
    remove_slot "$BLUE"
    die "new slot failed health check; legacy container still serving"
  fi
  write_caddyfile "$BLUE" "$CADDYFILE"
  if ! validate_caddyfile "$CADDYFILE"; then
    remove_slot "$BLUE"
    die "caddy config is invalid; legacy container still serving"
  fi
  log "handing :${HOST_PORT} from ${LEGACY_NAME} to ${CADDY_NAME}"
  docker stop -t 10 "$LEGACY_NAME" >/dev/null
  if ! start_caddy; then
    docker rm -f "$CADDY_NAME" >/dev/null 2>&1 || true
    docker start "$LEGACY_NAME" >/dev/null || true
    remove_slot "$BLUE"
    die "caddy did not start; legacy start was requested"
  fi
  if ! wait_url "http://127.0.0.1:${HOST_PORT}/visa-processing" || ! wait_url "$PUBLIC_URL"; then
    log "proxy check failed, restoring ${LEGACY_NAME}"
    docker rm -f "$CADDY_NAME" >/dev/null 2>&1 || true
    docker start "$LEGACY_NAME" >/dev/null
    if ! wait_url "http://127.0.0.1:${HOST_PORT}/visa-processing"; then
      die "restore failed; ${LEGACY_NAME} did not become healthy. ${BLUE} is still running on ${NETWORK}"
    fi
    remove_slot "$BLUE"
    die "bootstrap rolled back to ${LEGACY_NAME}"
  fi
  write_state blue "$image"
  log "bootstrapped ${ENV_NAME}; ${LEGACY_NAME} is stopped and can be removed after a later successful deploy"
}

cmd_deploy() {
  local image="$2"
  local skip="${3:-}"
  need_env "$1"
  lock
  validate_image_ref "$image"
  local sha
  sha="$(parse_sha_tag "$image")"
  [[ -f "$ENV_FILE" ]] || die "missing ${ENV_FILE}"
  [[ -f "$STATE_FILE" ]] || die "run bootstrap before deploy"
  container_running "$CADDY_NAME" || die "proxy ${CADDY_NAME} is not running"
  check_db_hosts
  local active new_color new_name
  active="$(read_active_slot)"
  if [[ "$active" == "blue" ]]; then
    new_color=green
    new_name="$GREEN"
  else
    new_color=blue
    new_name="$BLUE"
  fi
  log "pulling ${image}"
  docker pull "$image" >/dev/null
  if [[ "$skip" == "--skip-migrate" ]]; then
    log "skipping migrations"
  else
    migrate_sha "$sha"
  fi
  start_slot "$new_name" "$image"
  if ! wait_healthy "$new_name"; then
    remove_slot "$new_name"
    die "new slot failed health check; traffic stayed on ${SLOT_PREFIX}-${active}"
  fi
  if ! flip_to "$new_name"; then
    log "flip failed, returning traffic to ${SLOT_PREFIX}-${active}"
    if reload_caddy "${SLOT_PREFIX}-${active}"; then
      remove_slot "$new_name"
    fi
    die "traffic stayed on ${SLOT_PREFIX}-${active}"
  fi
  write_state "$new_color" "$image"
  drain "${SLOT_PREFIX}-${active}"
  log "deployed ${ENV_NAME} -> ${new_name}"
}

cmd_rollback() {
  need_env "$1"
  lock
  [[ -f "$STATE_FILE" ]] || die "nothing to roll back"
  container_running "$CADDY_NAME" || die "proxy ${CADDY_NAME} is not running"
  local active previous_color previous_name
  active="$(read_active_slot)"
  if [[ "$active" == "blue" ]]; then
    previous_color=green
    previous_name="$GREEN"
  else
    previous_color=blue
    previous_name="$BLUE"
  fi
  container_exists "$previous_name" || die "previous slot ${previous_name} is gone"
  if ! container_running "$previous_name"; then
    log "starting ${previous_name}"
    docker start "$previous_name" >/dev/null
  fi
  if ! wait_healthy "$previous_name"; then
    die "previous slot is unhealthy; traffic stayed on ${SLOT_PREFIX}-${active}"
  fi
  local previous_image
  previous_image="$(docker inspect -f '{{.Config.Image}}' "$previous_name")"
  if ! flip_to "$previous_name"; then
    if ! reload_caddy "${SLOT_PREFIX}-${active}"; then
      die "rollback flip failed and the proxy could not return to ${SLOT_PREFIX}-${active}"
    fi
    die "rollback flip failed; traffic stayed on ${SLOT_PREFIX}-${active}"
  fi
  write_state "$previous_color" "$previous_image"
  drain "${SLOT_PREFIX}-${active}"
  log "rolled back ${ENV_NAME} -> ${previous_name}"
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    bootstrap) [[ $# -eq 2 ]] || { usage; exit 1; }; cmd_bootstrap "$2" ;;
    deploy)
      [[ $# -eq 3 || $# -eq 4 ]] || { usage; exit 1; }
      cmd_deploy "$2" "$3" "${4:-}"
      ;;
    rollback) [[ $# -eq 2 ]] || { usage; exit 1; }; cmd_rollback "$2" ;;
    status) cmd_status "${2:-}" ;;
    check-db) [[ $# -eq 2 ]] || { usage; exit 1; }; cmd_check_db "$2" ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
