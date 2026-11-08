# Uptime Kuma monitors (manual)

Kuma has no first-class “monitors as code” in this repo. After `./scripts/up.sh uptime` (or `full`):

1. SSH-tunnel to `http://127.0.0.1:3050` and create the admin user.
2. Add HTTP(s) monitors (interval 60s, keyword optional). Staging and production hosts separately:
   - **Liveness** (same path as blue-green `wait_healthy`; do not treat this as “ready for traffic”):
     `https://visatop.com/visa-processing/api/health`
     `https://app-staging.visatop.com/visa-processing/api/health`
     Liveness is **DB-free**. Keep this on staging; it does not keep Neon awake.
   - **Home / apply start** — production: `https://visatop.com/visa-processing/`
     Expect HTTP 200 and a keyword such as `Start your application` or `Traveling to Dubai`.
     Home HTML is DB-free. **Do not** add a staging home monitor that executes JS or hits catalog APIs.
   - **Apply start with nationality** — **production only**:
     `https://visatop.com/visa-processing/apply/start?nationality=IN`
     Expect HTTP 200. `/apply/start` without `nationality` redirects home.
     This SSR path queries `catalog_customer_price`. A 60s staging copy keeps `weathered-resonance` awake.
   - **Readiness** — **production only**: `https://visatop.com/visa-processing/api/health/ready`
     Expect HTTP 200. Treat 503 as down. Never point blue-green drain/health here.
     Staging `GET /api/health/ready` skips the DB ping unless `STAGING_ALLOW_IDLE_DB_WAKE=true`. Still prefer not to poll it on staging.
   - **Payment health (production only)** — `https://visatop.com/visa-processing/api/internal/health/payments`
     Method GET. Header `x-internal-secret: <INTERNAL_CRON_SECRET from /root/visatop/.env>`.
     Expect HTTP 200. Treat 503 as down (webhook URL not prod, webhooks silent after widget open, or Ziina completed but local row still `checkout_created`).
     See [`docs/ops/host-cron-and-payment-health.md`](../../../docs/ops/host-cron-and-payment-health.md).
3. Notification: email + the same WhatsApp-compatible webhook as Grafana (`GRAFANA_ALERT_WEBHOOK_URL`).
4. Optional Docker-network monitor: `http://visatop-edge-prod:3000/visa-processing/api/health` (Kuma is attached to `visatop_edge`).

See `docs/observability/sentry.md` for the full readiness vs liveness split.

Kuma on this droplet cannot alert if the VM is off. Add an external ping if Farouk wants that coverage — see `docs/observability/infra.md`.
