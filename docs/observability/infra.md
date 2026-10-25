# Infra observability (self-hosted on the droplet)

This is **Observability 5** of six parallel observability PRs. It may need a rebase. It does **not** change Caddy routing or `scripts/blue-green-deploy.sh` cutover behaviour.

VisaTop already runs on one DigitalOcean droplet: Docker blue/green app slots behind Caddy (`scripts/blue-green-deploy.sh`), GitHub Actions `.github/workflows/deploy.yml`, Postgres on **Neon**. This stack adds **opt-in** host/container metrics, log shipping, traces, error tracking, uptime checks, and Grafana alerts **on that same droplet**.

**Nothing in this folder is started by a deploy.** Farouk starts it once, on purpose.

## Why not Grafana Cloud / SaaS

All backends stay on the droplet: Grafana, Prometheus, Loki, Tempo, Grafana Alloy, GlitchTip (Sentry-compatible), Uptime Kuma. Credentials never leave the host except the email/WhatsApp webhooks Farouk configures for paging.

## Same-host caveat (read this)

If the droplet dies, this stack dies with it and **cannot page**. Uptime Kuma “pinging out” still runs on the droplet, so it does not solve that.

Farouk should pick one:

1. **Accept the gap** and rely on DigitalOcean alerting / a phone ping when the site is unreachable.
2. **Optional free external ping** (UptimeRobot, HetrixTools, cron-job.org, or similar) hitting `https://visatop.com/visa-processing/api/health` from outside. That is the only way to learn the VM is gone. Decision is Farouk’s; this repo does not sign up for a third-party monitor.

Kuma on the droplet is still useful for synthetic checks (staging vs prod, extra paths) and for WhatsApp/email when the VM is up but the app is not.

## Resource budget

Check live size before starting:

```bash
nproc
free -h
df -h /
docker stats --no-stream
```

Assumptions (adjust if the droplet differs):

| What already runs | Rough RSS |
| --- | --- |
| Production Next.js slot | 250–450 MB |
| Staging Next.js slot | 250–450 MB |
| Two Caddy edge containers | ~40–80 MB |
| Docker + OS | 300–600 MB |

Observability profiles (limits in `deploy/observability/docker-compose.yml`):

| Profile | Services | Cap (sum of `mem_limit`) | Retention |
| --- | --- | --- | --- |
| `core` | Alloy, Prometheus, Loki, Tempo, Grafana, obs-Caddy | ~2.2 GB | metrics/logs 15d, traces 14d |
| `caddy-metrics` | socat sidecars into Caddy netns | 32 MB | n/a |
| `errors` | GlitchTip web + worker + Postgres + Redis | ~1.0 GB | events 15d (`GLITCHTIP_MAX_EVENT_LIFE_DAYS`) |
| `uptime` | Uptime Kuma | 192 MB | Kuma’s own DB |
| `full` | all of the above | ~3.4 GB | 15–30d as configured |

**Recommendation:** 8 GB RAM droplet for `full` plus staging+prod. A 4 GB droplet should run **`core` only** (skip GlitchTip/Kuma) or the app will fight the collector for memory. During a blue/green deploy a third Next.js container exists for ~90s — leave ~500 MB free.

Raise retention to 30 days only after `df -h` shows comfortable headroom (Prometheus `retention.size` is 6 GB; Loki/Tempo volumes grow with traffic).

## What is collected

| Signal | How | Backend |
| --- | --- | --- |
| Host CPU / mem / disk | Alloy `prometheus.exporter.unix` (node_exporter) | Prometheus |
| Container CPU / mem / restarts | Alloy `prometheus.exporter.cadvisor` | Prometheus |
| Docker logs | Alloy `loki.source.docker` (Pino JSON from the app + Caddy JSON access logs from `write_caddyfile`) | Loki |
| Caddy metrics | Caddy admin `127.0.0.1:2019/metrics` via socat on `:2020` in the Caddy network namespace (does **not** change routing or the JSON access-log block from structured logging) | Prometheus |
| App traces | OTLP `:4317`/`:4318` on `visatop-alloy` (join `visatop_edge`) | Tempo |
| Tail sampling | Keep ERROR spans, traces ≥ 2s, plus 5% | Tempo |
| PII in logs | Alloy `loki.process` redacts emails, labelled passport numbers, `Authorization` (second line of defense after `lib/logger.ts`) | Loki |
| JS exceptions | App `SENTRY_DSN` → GlitchTip (`@sentry/nextjs`, see [`sentry.md`](sentry.md)) | GlitchTip |
| Synthetics | Uptime Kuma + Alloy blackbox probes | Kuma / Prometheus |

Alloy blackbox probes hit local `visatop-edge-prod:3000/visa-processing/api/health` and `visatop-edge-staging:3001/...`, plus the public liveness URLs. Uptime Kuma should also cover `/api/health/ready`, home, and apply/start (see [`sentry.md`](sentry.md) and `deploy/observability/kuma/monitors.md`). Never point blue-green `wait_healthy` at `/api/health/ready`.

## UIs — localhost or Caddy+auth, never public unauthenticated

Compose publishes **127.0.0.1 only**:

| App | Port |
| --- | --- |
| Grafana (native login) | `127.0.0.1:3030` |
| GlitchTip (native login) | `127.0.0.1:3040` |
| Uptime Kuma (create admin on first visit) | `127.0.0.1:3050` |
| Prometheus (debug) | `127.0.0.1:9090` |
| Obs Caddy + basic_auth | `127.0.0.1:3080` Grafana, `:3081` GlitchTip, `:3082` Kuma |

SSH tunnel:

```bash
ssh -L 3030:127.0.0.1:3030 -L 3040:127.0.0.1:3040 -L 3050:127.0.0.1:3050 \
  -L 3080:127.0.0.1:3080 USER@DROPLET
```

Do **not** add `0.0.0.0` publish flags. If Farouk later wants `obs.visatop.com`, point droplet nginx at `127.0.0.1:3080` (Caddy basic_auth) and keep Grafana anonymous auth **off**.

## Rollout (Farouk)

Work from the repo checkout the droplet already uses (`/root/visatop/dev` in `blue-green-deploy.sh`).

### 1. Copy env and fill secrets

```bash
mkdir -p /root/visatop/deploy/observability
cd /root/visatop/dev
git pull   # this branch, after merge, or cherry-pick
cp deploy/observability/env.example /root/visatop/deploy/observability/.env
chmod 600 /root/visatop/deploy/observability/.env
```

If compose is run from the git checkout:

```bash
cd /root/visatop/dev/deploy/observability
cp env.example .env
chmod 600 .env
```

Edit `.env`:

- `GF_SECURITY_ADMIN_PASSWORD` — long random
- `GRAFANA_ALERT_EMAIL` — where pages go
- Mailgun SMTP (`GF_SMTP_*`) — EU host `smtp.eu.mailgun.org:587` matches existing Mailgun
- `OBS_BASIC_AUTH_PASSWORD` — plaintext; `up.sh` hashes it for Caddy (do not paste bcrypt; `$` breaks Compose)

- GlitchTip: `GLITCHTIP_SECRET_KEY`, `GLITCHTIP_POSTGRES_PASSWORD` (only if starting `errors`/`full`)
- `GRAFANA_ALERT_WEBHOOK_URL` — WhatsApp-compatible webhook when ready; placeholder is fine until then (email still works)

### 2. Confirm Caddy is already serving (blue/green untouched)

```bash
/root/visatop/dev/scripts/blue-green-deploy.sh status
```

Do not rewrite Caddyfiles. Caddy metrics are scraped through the socat sidecar on the Caddy container’s network namespace.

### 3. Start the stack (explicit)

```bash
cd /root/visatop/dev/deploy/observability
chmod +x scripts/*.sh
./scripts/up.sh core     # metrics, logs, traces, Grafana
# later:
./scripts/up.sh errors   # GlitchTip
./scripts/up.sh uptime   # Kuma
./scripts/up.sh full     # everything
```

`up.sh` refuses to start if `.env` still has `change-me` placeholders. It creates `visatop_edge` only if missing. It does **not** register a systemd unit; add one yourself if you want restart-on-boot:

```ini
# /etc/systemd/system/visatop-obs.service  (optional — Farouk enables this)
[Service]
WorkingDirectory=/root/visatop/dev/deploy/observability
ExecStart=/usr/bin/docker compose --env-file .env --profile full up
ExecStop=/usr/bin/docker compose --profile full down
Restart=always
```

Leave it disabled until you are happy.

### 4. App env (after the collector is up)

Add to `/root/visatop/.env` and `/root/visatop/.env.staging` (runtime env files already passed into app containers). Then **redeploy** so the new slot picks them up — this PR does not inject them in `start_slot`.

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4318
OTEL_SERVICE_NAME=visatop-next-js
```

GlitchTip DSN (after creating org `visatop` / project `visatop-next` in the GlitchTip UI). Full SDK/env notes: [`sentry.md`](sentry.md).

```
SENTRY_DSN=http://<public_key>@visatop-glitchtip:8000/1
APP_ENV=production
```

Staging runtime env uses `APP_ENV=staging`. Do **not** use `NODE_ENV` for GlitchTip environment tags (images already run `NODE_ENV=production`). Browser events also need `NEXT_PUBLIC_SENTRY_DSN` in `STAGING_BUILD_ENV` / `PROD_BUILD_ENV`.

`instrumentation.ts` exports OTLP when the endpoint is set, and loads `@sentry/nextjs` when a DSN is present. Releases are also created by the deploy-marker script.

Images receive `GIT_SHA` / `RELEASE_SHA` / `APP_ENV` / `SENTRY_RELEASE` at **build** time (`deploy.yml` build-args).

### 5. Grafana

Tunnel to `:3030`, sign in, open folder **VisaTop** → dashboard **VisaTop health**. Alert rules are provisioned (read-only in the UI). Contact point `visatop-ops` sends email + webhook.

### 6. GlitchTip

Tunnel to `:3040`, create the first user, org slug `visatop`, project slug `visatop-next`. Create an auth token and put it in `.env` as `GLITCHTIP_AUTH_TOKEN` so deploy markers can open releases.

### 7. Uptime Kuma

Tunnel to `:3050`, create the admin user, then monitors (staging and production hosts separately). Details in `deploy/observability/kuma/monitors.md` and [`sentry.md`](sentry.md):

- Liveness: `https://<host>/visa-processing/api/health` (blue-green `wait_healthy` only)
- Home: `https://<host>/visa-processing/`
- Apply start (optional): `https://<host>/visa-processing/apply/start?nationality=IN`
- Readiness: `https://<host>/visa-processing/api/health/ready` (HTTP 200; 503 = down)
- Optional Docker-network: `http://visatop-edge-prod:3000/visa-processing/api/health`

Notification: same email and the WhatsApp-compatible webhook used in Grafana.

Kuma plus an **external** ping is how you cover “droplet is dead”.

### 8. Caddy metrics sidecar

`up.sh core` and `up.sh full` start `caddy-metrics` only if `visatop-edge-prod` and `visatop-edge-staging` exist. After a Caddy recreate:

```bash
cd /root/visatop/dev/deploy/observability
docker compose --env-file .env --profile caddy-metrics up -d
```

### 9. Confirm it is not starving the app

```bash
docker stats --no-stream
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/visa-processing/api/health
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/visa-processing/api/health
```

Stop with `./scripts/down.sh` (volumes kept).

## Deploy markers

After a successful SSH deploy, `.github/workflows/deploy.yml` runs `deploy/observability/scripts/record-deploy-markers.sh` on the droplet via stdin (same pattern as blue-green). It:

1. POSTs a Grafana annotation tagged `deploy` + environment, using Grafana admin basic auth on `127.0.0.1:3030`
2. POSTs a GlitchTip/Sentry release `sha-<gitsha>` when `GLITCHTIP_AUTH_TOKEN` is set

If Grafana/GlitchTip are down or secrets are missing, the script **prints `skip` and exits 0**. It never fails the deploy.

## Dockerfile HEALTHCHECK vs blue-green

The image now has:

```
HEALTHCHECK … fetch http://127.0.0.1:3000/visa-processing/api/health
```

`wait_healthy` in `scripts/blue-green-deploy.sh` does **not** read `State.Health`. It `docker exec`s the same path (and `/visa-processing` as fallback). `--restart unless-stopped` does not restart on `unhealthy`. Adding HEALTHCHECK does not change cutover.

## Neon / Postgres metrics

The app database is **Neon**, not on the droplet. This compose stack cannot scrape `pg_stat_activity` without a connection string in Alloy (do **not** put `DATABASE_URL` into the collector; it would bypass RLS and widen secret sprawl).

Two supported approaches (Farouk chooses):

### A. Neon Grafana / Datadog integration (preferred for connections)

Neon can export metrics over OTLP to a Grafana Cloud stack, Datadog, or a generic OTLP endpoint ([Neon Grafana Cloud](https://neon.com/docs/guides/grafana-cloud), [metrics reference](https://neon.com/docs/reference/metrics-logs)). Useful series:

- `neon_connection_counts` (active / idle)
- `neon_pgbouncer_pools_*` (client waiting, server idle, max wait)
- `neon_pg_stats_userdb` (size, deadlocks, rows in/out)
- Compute CPU/memory, cache hits/misses

**Self-hosted Grafana on the droplet:** Neon’s first-party Grafana integration targets Grafana **Cloud** OTLP. Pointing Neon at this droplet’s Alloy (`0.0.0.0:4318`) would require exposing OTLP on the public internet — **do not**. If you want Neon metrics in this Grafana, use Neon’s Datadog integration (SaaS) **or** query `pg_stat_statements` from a locked-down admin notebook (B).

Datadog: Neon project → Integrations → Datadog. Same metric set, Datadog dashboards for failed connections / saturation.

### B. `pg_stat_statements` on the Neon branch (slow queries)

In the SQL editor (direct host, not pooler):

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

Slow queries (no bind params / PII in `query` if you use parameterized Drizzle — still treat the output as sensitive):

```sql
SELECT
  left(query, 120) AS query,
  calls,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round(total_exec_time::numeric, 2) AS total_ms,
  rows
FROM pg_stat_statements
WHERE mean_exec_time > 50
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Connections right now:

```sql
SELECT datname, usename, state, count(*)
FROM pg_stat_activity
GROUP BY 1, 2, 3;
```

Failed connections do not show up in `pg_stat_statements`. Use Neon’s metrics integration (`neon_pgbouncer_*`, compute logs) or the Neon console “Monitoring” for connection errors and pooler rejects.

Cleanup of expired drafts and webhook health timestamps stay in-app (`platform_setting` webhook keys); they are not a substitute for Neon connection metrics.

## Backups

```bash
/root/visatop/dev/deploy/observability/scripts/backup.sh /root/visatop/backups/obs
```

Tarballs named volumes (Prometheus, Loki, Tempo, Grafana, GlitchTip Postgres, Kuma). **Neon is backed up by Neon**, not this script. Keep 7–14 days of tarballs; pair with DigitalOcean droplet snapshots. After restore, `./scripts/up.sh full`.

## Alerts (as code)

Provisioned in `deploy/observability/grafana/provisioning/alerting/`:

| Alert | Signal |
| --- | --- |
| Site down | `probe_success` (local + public health) |
| 5xx / error spike | Caddy 5xx rate |
| Disk > 80% | `node_filesystem_*` |
| Memory > 80% | `node_memory_*` |
| Container restarts | cAdvisor `container_restart_count` / start time |
| Webhook 401s | log metric `visatop_webhook_401_total` (`webhook_signature_rejected`) |
| Unmatched webhooks | `visatop_webhook_unmatched_total` |
| OCR error spike | `visatop_ocr_failed_total` (`[extract] failed`) |
| Checkouts but no paid for 6h | `visatop_checkout_created_total` vs `visatop_payment_paid_total` |

Routing: Grafana contact point `visatop-ops` (email + webhook). Kuma notifications are configured in its UI.

## Parallel PRs

This change is infra-only plus a few stable log breadcrumbs (`[checkout] checkout_created`, `[payments] marked_paid`, `webhook_signature_rejected`, `webhook_unmatched`, `[extract] failed`) so those alerts have something to scrape. Those markers are Pino fields/messages (Observability 1, `docs/observability/logging.md`); Caddy JSON access logs come from `scripts/blue-green-deploy.sh` `write_caddyfile`. GlitchTip SDK wiring, `APP_ENV`, and `GET /api/health/ready` landed in Observability 2 (`docs/observability/sentry.md`).
