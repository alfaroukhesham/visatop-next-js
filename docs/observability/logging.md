# Structured logging

App logs are JSON (Pino) on process stdout. On the droplet they are scraped by **Grafana Alloy** into **self-hosted Loki**. Log shipping (Alloy/Loki config) lives in a separate infra PR. This document is the application contract: fields, redaction, and what not to log.

This change is one of six parallel observability PRs and may need a rebase before merge.

## Logger

Use `@/lib/logger`:

- `logger` — process-wide logger (`service`, `env`, `release` on every line).
- `createRequestLogger(requestId)` — child logger for a request. Pass `headers().get("x-request-id")` from `proxy.ts`.

Do not use `console.*` in server code (API routes, `lib/payments/*`, OCR, email). Client components may still use `console` for browser diagnostics.

## Base fields (every line)

| Field | Source | Notes |
| --- | --- | --- |
| `service` | `OTEL_SERVICE_NAME` | Defaults to `visatop-next-js`. |
| `env` | `APP_ENV` | Real deploy class: `staging` or `production`. **Not** `NODE_ENV` (both droplet images run with `NODE_ENV=production`). Unset → `unknown`. |
| `release` | `GIT_SHA`, else `GIT_COMMIT_SHA`, else `SOURCE_VERSION` | Git SHA of the running image. Unset → `unknown`. |
| `level` / `time` / `msg` | Pino | Standard Pino keys. |

`.github/workflows/deploy.yml` passes `APP_ENV` and `GIT_SHA` as Docker build-args (shared with GlitchTip). Staging and production must not share the same `APP_ENV`. See also [`docs/observability/sentry.md`](sentry.md).

`LOG_LEVEL` overrides the default (`info` when `NODE_ENV=production`, otherwise `debug`).

## Request and trace correlation

`proxy.ts` sets `x-request-id` (incoming or generated) on matched routes and echoes it on the response. Route handlers already pass it into `jsonOk` / `jsonError`.

`createRequestLogger(requestId)` adds:

| Field | When |
| --- | --- |
| `requestId` | Non-empty `x-request-id`. |
| `traceId` / `spanId` | Active OpenTelemetry span (`trace.getActiveSpan()`), when the span context is valid. |

The same trace bindings are mixed into every log line when a span is active, so logs join Tempo/OTLP traces without copying IDs by hand.

## Redaction

Redaction is a **backstop**. Prefer small structured fields (ids, statuses, hashes). Never put PII, document bytes, OCR JSON, or raw webhook bodies in log objects.

Serialized values matching these keys (top-level and one nested level, plus a recursive key walk) are replaced with `[redacted]`:

- Identity: `email`, `guestEmail`, `fullName`, `firstName`, `lastName`, `name`, `passportNumber`, `phone`, `address`, `dateOfBirth`
- Secrets: `token`, `tokens`, `accessToken`, `refreshToken`, `idToken`, `password`, `cookie`, `cookies`, `set-cookie`, `authorization`
- Webhook bodies (safety net): `rawBody`, `bodyText`, `rawPayload`, `webhookPayload`
- Existing globs: keys matching `passport`, `ocr`, `extraction`, `pii*`, and document *content* keys (`documentBlob`, …). `documentId` and `documentType` stay visible.

Header-shaped paths (`req.headers.authorization`, `headers.cookie`, …) are also redacted.

Tests: `lib/logger.test.ts`.

## Webhooks

Never log raw webhook payloads (Paddle, Ziina, Fincra). Log event type, provider/merchant references, payment id, outcome, and payload **hash** only. Signature failures may log `hasSignatureHeader` (boolean), not the header value.

## Caddy access logs

`scripts/blue-green-deploy.sh` `write_caddyfile` emits a site-level JSON access log to **stdout** (Docker logs). Routing, trusted proxies, and blue-green flip behavior are unchanged. Alloy should scrape the Caddy container stdout into the same self-hosted Loki.

File rotation is not used in the container: stdout is the Docker/Alloy contract. Do not add a host bind-mount for Caddy logs unless infra explicitly wants a file sink.

## Query examples (LogQL against self-hosted Loki)

```logql
{service="visatop-next-js", env="production"}
{service="visatop-next-js"} |= "webhooks/fincra"
{service="visatop-next-js"} | json | requestId="…"
```
