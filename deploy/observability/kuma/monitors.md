# Uptime Kuma monitors (manual)

Kuma has no first-class “monitors as code” in this repo. After `./scripts/up.sh uptime` (or `full`):

1. SSH-tunnel to `http://127.0.0.1:3050` and create the admin user.
2. Add HTTP(s) monitors (interval 60s, keyword optional). Staging and production hosts separately:
   - **Liveness** (same path as blue-green `wait_healthy`; do not treat this as “ready for traffic”):
     `https://visatop.com/visa-processing/api/health`
     `https://app-staging.visatop.com/visa-processing/api/health`
   - **Home / apply start** — `https://<host>/visa-processing/`
     Expect HTTP 200 and a keyword such as `Start your application` or `Traveling to Dubai`.
   - **Apply start with nationality** (optional) — `https://<host>/visa-processing/apply/start?nationality=IN`
     Expect HTTP 200. `/apply/start` without `nationality` redirects home.
   - **Readiness** — `https://<host>/visa-processing/api/health/ready`
     Expect HTTP 200. Treat 503 as down. Never point blue-green drain/health here.
3. Notification: email + the same WhatsApp-compatible webhook as Grafana (`GRAFANA_ALERT_WEBHOOK_URL`).
4. Optional Docker-network monitor: `http://visatop-edge-prod:3000/visa-processing/api/health` (Kuma is attached to `visatop_edge`).

See `docs/observability/sentry.md` for the full readiness vs liveness split.

Kuma on this droplet cannot alert if the VM is off. Add an external ping if Farouk wants that coverage — see `docs/observability/infra.md`.
