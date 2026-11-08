# Host crontab and payment health

Documentation only. Do not change the droplet from this file.

Staging and production share **one Ziina access token**. A `POST` to Ziina `/webhook` overwrites the account URL. **Never run Admin → Payments → Register webhook from staging.** If Ziina webhooks stop on production, first check whether the webhook URL was taken by staging, then re-register from **production** admin.

## Root-only env

On the droplet, cron must read `INTERNAL_CRON_SECRET` from a root-only file (not world-readable):

- Production: `/root/visatop/.env`
- Staging: `/root/visatop/.env.staging` (do **not** register the Ziina webhook here; do **not** install a staging `*/5` crontab if `weathered-resonance` should scale to zero)

Optional on production:

```bash
# Exact URL Ziina must call. Used by GET /api/internal/health/payments.
ZIINA_EXPECTED_WEBHOOK_URL=https://visatop.com/visa-processing/api/webhooks/ziina
```

## Crontab (production)

Run as root. Source the env file in a tiny wrapper so the secret never appears in `crontab -l` process lists as a literal on every curl, or keep it in the wrapper script with `chmod 700`.

```bash
# /root/visatop/bin/internal-cron.sh  (mode 700)
#!/usr/bin/env bash
set -euo pipefail
set -a
# shellcheck disable=SC1091
source /root/visatop/.env
set +a
SECRET="${INTERNAL_CRON_SECRET:?}"
BASE="https://visatop.com/visa-processing"
NAME="$1"
METHOD="${2:-POST}"
curl -fsS -X "$METHOD" -H "x-internal-secret: ${SECRET}" "$BASE/api/internal/${NAME}" >/dev/null
```

```cron
# Every 5 minutes: provider reconcile (paid + expire stale / Fincra expired)
*/5 * * * * /root/visatop/bin/internal-cron.sh reconcile-ziina-payments
*/5 * * * * /root/visatop/bin/internal-cron.sh reconcile-fincra-payments

# Every 5 minutes: Ziina webhook conflict + silence + completed-unpaid (detection only).
# Uptime Kuma is the pager (non-200). This cron is the host-side scheduled check.
*/5 * * * * /root/visatop/bin/internal-cron.sh health/payments GET

# Hourly
0 * * * * /root/visatop/bin/internal-cron.sh cleanup-drafts
0 * * * * /root/visatop/bin/internal-cron.sh retry-meta-capi-purchases

# Every 15 minutes: checkout-opened-not-paid recovery email
# (no-ops until RECOVERY_EMAILS_ENABLED=true in /root/visatop/.env)
# Eligible window: checkout created between DELAY minutes and MAX_AGE hours ago
# (defaults 60 minutes … 24 hours). First enable does not mail a 14-day backlog.
*/15 * * * * /root/visatop/bin/internal-cron.sh recovery-emails
```

The wrapper calls `/api/internal/<name>` with header `x-internal-secret`. Default method is POST; payment health is GET.

## Uptime Kuma — payment health

Add an HTTP(s) monitor (interval 60–120s) that **fails on non-200**:

- **URL:** `https://visatop.com/visa-processing/api/internal/health/payments`
- **Method:** GET
- **Header:** `x-internal-secret: <INTERNAL_CRON_SECRET from /root/visatop/.env>`
- **Accepted status:** 200 only
- Optional Docker-network URL: `http://visatop-edge-prod:3000/visa-processing/api/internal/health/payments`

`503` means one of:

1. **Webhook URL mismatch** — Ziina’s registered URL is not prod (`webhook registered to <host>, not prod`). Re-register from production admin.
2. **Webhook silence (Alert A)** — at least 3 consecutive widget-opened intents got no Ziina webhook on prod within ~2 minutes.
3. **Completed but unpaid (Alert B, top priority)** — Ziina `completed` after the return handler and the 15-minute reconcile probe, local row still `checkout_created`.

Ziina’s public API documents POST/DELETE `/webhook` only. The health check **attempts GET `/webhook`**. If that is unreadable, the alert still names the last host that ran Register webhook on this environment and tells ops to check staging.

Do not point this monitor at staging: staging stealing the URL is the failure mode we are detecting on **prod**.

## Staging idle (weathered-resonance) — recommendations only

Do not run these from a laptop agent. On the droplet, as root, inspect then pause **staging** wake sources. Leave production crontab, Kuma prod monitors, and `/root/visatop/.env` unchanged.

App code on `APP_ENV=staging` already no-ops `/api/health/ready` DB pings and `/api/internal/*` cron DB work unless `STAGING_ALLOW_IDLE_DB_WAKE=true`. That does **not** stop:

- Kuma (or any HTTP monitor) hitting `https://app-staging.visatop.com/visa-processing/apply/start?nationality=IN` (SSR catalog)
- Catalog APIs / checkout tabs / Playwright synthetics against staging
- A staging crontab that still fires (harmless after deploy, but remove it so logs stay quiet)

Alloy blackbox and Docker `HEALTHCHECK` hit `/api/health` (DB-free) — leave them.

```bash
# 1) What crontab exists? Look for app-staging / .env.staging wrappers.
crontab -l
ls -l /root/visatop/bin/
grep -R --line-number -E 'app-staging|env.staging|reconcile-|health/payments' /root/visatop/bin/ /var/spool/cron/crontabs/ 2>/dev/null || true

# 2) If a staging wrapper exists, comment its crontab lines (do not delete the script).
# crontab -e
# # */5 * * * * /root/visatop/bin/internal-cron-staging.sh reconcile-ziina-payments
# Then: crontab -l | grep -v '^#' | grep -i staging || echo 'no active staging cron'

# 3) Kuma: pause staging monitors that are not liveness.
# Tunnel: ssh -L 3050:127.0.0.1:3050 root@<droplet>
# Keep:  https://app-staging.visatop.com/visa-processing/api/health
# Pause: /api/health/ready, /apply/start?nationality=*, keyword checks that run a browser, Playwright synthetic.
# Optional sqlite list (container name visatop-kuma):
docker exec visatop-kuma sqlite3 /app/data/kuma.db \
  "select id, name, url, active, interval from monitor;"

# 4) Confirm liveness still 200 and ready does not need Neon:
curl -sS -o /dev/null -w '%{http_code}\n' https://app-staging.visatop.com/visa-processing/api/health
# Expect 200. Do not loop /apply/start or catalog APIs.

# 5) During a payment/reconcile test on staging only:
# In /root/visatop/.env.staging set STAGING_ALLOW_IDLE_DB_WAKE=true, recreate the
# staging app container (blue-green-deploy.sh deploy staging <image>), run the test,
# then unset the flag and recreate again. Never put this in /root/visatop/.env.
```
