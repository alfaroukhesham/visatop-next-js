# Host crontab and payment health

Documentation only. Do not change the droplet from this file.

Staging and production share **one Ziina access token**. A `POST` to Ziina `/webhook` overwrites the account URL. **Never run Admin → Payments → Register webhook from staging.** If Ziina webhooks stop on production, first check whether the webhook URL was taken by staging, then re-register from **production** admin.

## Root-only env

On the droplet, cron must read `INTERNAL_CRON_SECRET` from a root-only file (not world-readable):

- Production: `/root/visatop/.env`
- Staging: `/root/visatop/.env.staging` (reconcile/cleanup only; do **not** register the Ziina webhook here)

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
