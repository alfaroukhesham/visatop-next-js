# Error tracking and readiness (GlitchTip + Uptime Kuma)

VisaTop uses the official `@sentry/nextjs` SDK against **self-hosted GlitchTip** on the DigitalOcean droplet. Events stay on our server. There is no Sentry SaaS project, no `sentry.io` ingest, and no Session Replay (GlitchTip does not support it; Microsoft Clarity already covers session UX).

Droplet Grafana / Alloy / Loki / Tempo / GlitchTip compose and Uptime Kuma setup live in [`infra.md`](infra.md) (`deploy/observability/`). Others may still touch `lib/logger.ts`, `instrumentation.ts`, or deploy scripts.

## What is wired

| Surface | File | Notes |
| --- | --- | --- |
| Browser | `instrumentation-client.ts` | Init only when `NEXT_PUBLIC_SENTRY_DSN` is set |
| Node | `sentry.server.config.ts` | Loaded from `instrumentation.ts` `register()` |
| Edge | `sentry.edge.config.ts` | Same DSN gate |
| Request errors | `onRequestError` in `instrumentation.ts` | No-op without a DSN |
| React | `app/error.tsx`, `app/global-error.tsx` | `Sentry.captureException` when enabled |
| Build | `next.config.ts` → `withSentryConfig` | Source-map upload **off** unless GlitchTip URL + token are both set |
| Liveness | `GET /api/health` | Unchanged — blue-green `wait_healthy` |
| Readiness | `GET /api/health/ready` | DB ping + payment/OCR config booleans |

`basePath` is `/visa-processing`. Public URLs are `/visa-processing/...`.

## Environment

All of these are documented in `.env.example`.

### Required to actually send events

- `SENTRY_DSN` — server/edge. Runtime on the droplet (`.env` / `.env.staging`).
- `NEXT_PUBLIC_SENTRY_DSN` — browser. Must be in `STAGING_BUILD_ENV` / `PROD_BUILD_ENV` because `NEXT_PUBLIC_*` is baked at image build.

Use a GlitchTip DSN (`https://<key>@<glitchtip-host>/<project>`). Leave both empty in local/CI: the SDK does not init and `next build` does **not** need an auth token.

### Environment and release (not `NODE_ENV`)

Staging containers still run `NODE_ENV=production`. Tag GlitchTip with a real environment:

- `APP_ENV` / `NEXT_PUBLIC_APP_ENV` — `staging` or `production`
- `GIT_SHA` / `SENTRY_RELEASE` / `NEXT_PUBLIC_*` counterparts — git sha

`.github/workflows/deploy.yml` passes `GIT_SHA` and `APP_ENV` as Docker build-args. The Dockerfile copies them into the image so server events have the same release as the client bundle.

### Optional

- `SENTRY_TRACES_SAMPLE_RATE` (default `0.1`) — modest Web Vitals / performance traces
- `NEXT_PUBLIC_PAYMENT_PROVIDER` — client-side `payment_provider` tag; server already reads `PAYMENT_PROVIDER`
- `SENTRY_URL` + `SENTRY_AUTH_TOKEN` (+ optional `SENTRY_ORG` / `SENTRY_PROJECT`) — upload source maps to **this** GlitchTip. If either is missing, upload is disabled and the build never talks to sentry.io. Plugin telemetry is off.

## PII

`beforeSend` / `beforeSendTransaction` (`lib/observability/sentry-scrub.ts`):

- Drop request bodies, cookies, headers, and query strings
- Redact email, name, passport, phone, DOB (and close variants) anywhere in the payload
- Keep `applicationId` and `payment_provider` tags

`sendDefaultPii` is false. Do not log passport images, OCR fields, or webhook bodies into GlitchTip extras.

Tags added when available:

- `release` — git sha
- `environment` — `APP_ENV`
- `applicationId` — from `/apply/applications/:id` paths
- `payment_provider` — `paddle` / `ziina` (active provider)

## Session Replay

Not enabled. GlitchTip cannot store Sentry Session Replay. Do not add `replayIntegration`. Clarity remains the session product; it already respects apply-screen tags in `lib/analytics/clarity-apply-screen.ts`. Consent Mode regions in `lib/analytics/consent-regions.ts` apply to marketing tags, not to this operational error pipeline.

## Readiness vs liveness

| URL | Role |
| --- | --- |
| `/visa-processing/api/health` | Process is up. No DB. Used by `scripts/blue-green-deploy.sh`. |
| `/visa-processing/api/health/ready` | Can serve traffic: DB `select 1`, payment secrets present for the active provider, `GEMINI_API_KEY` present. Response is `{ ready, checks: { database, payment, ocr } }` — booleans only. HTTP **200** if ready, **503** otherwise. |

Never point blue-green drain/health at `/api/health/ready` (a new color must pass liveness before it is fully configured).

## Uptime Kuma (self-hosted)

Uptime Kuma is deployed on the same droplet (`deploy/observability/`, see [`infra.md`](infra.md)). Create HTTP(s) monitors — not Grafana Synthetics or Better Stack.

Suggested monitors (staging and production hosts separately):

1. **Home / apply start** — `https://<host>/visa-processing/`  
   Expect HTTP 200 and a keyword such as `Start your application` or `Traveling to Dubai`.
2. **Apply start with nationality** (optional deeper check) — `https://<host>/visa-processing/apply/start?nationality=IN`  
   Expect HTTP 200. `/apply/start` without `nationality` redirects home.
3. **Readiness** — `https://<host>/visa-processing/api/health/ready`  
   Expect HTTP 200. Treat 503 as down.

Keep the existing liveness URL for deploy automation only.

## Playwright synthetic (cron / container)

HTTP monitors do not click the wizard. An optional Playwright script walks nationality → visa → draft → documents and, when a passport fixture is provided, continues to the **payment page without paying**.

```bash
# Against a running app (local production build or staging)
PLAYWRIGHT_BASE_URL=https://app-staging.visatop.com \
SYNTHETIC_NATIONALITY_CODE=IN \
SYNTHETIC_NATIONALITY_NAME=India \
SYNTHETIC_EMAIL=synthetic+uptime@visatop.com \
SYNTHETIC_PASSPORT_PATH=/opt/synthetics/passport.jpg \
pnpm run test:synthetic
```

- Config: `tests/synthetics/playwright.config.ts` (Chromium only, not part of `pnpm test:e2e`)
- Spec: `tests/synthetics/apply-to-payment.spec.ts`
- Reuses the same `PLAYWRIGHT_BASE_URL` / `basePath` conventions as `tests/e2e`
- Does **not** click Pay / open Paddle, Ziina, or Fincra checkout
- Needs a live catalog (demo seed or production data) and, to reach payment, a real image at `SYNTHETIC_PASSPORT_PATH` (email + passport copy are the pay-first gate)

Run it from a small container or cron on the droplet. Point Uptime Kuma at the job’s exit code or a sidecar that fails the monitor when Playwright fails.

## Local check

```bash
# no DSN → no-op
pnpm run lint && pnpm run test:ci && pnpm run build
```

Then, only on the droplet, set DSNs and confirm a test error appears in GlitchTip (not sentry.io).
