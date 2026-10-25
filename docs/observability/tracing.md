# OpenTelemetry tracing (VisaTop)

Production tracing is **self-hosted on the droplet**. The Next.js app exports OTLP/HTTP to **Grafana Alloy** on the `visatop_edge` Docker network; Alloy writes traces to **self-hosted Tempo**. There is no Grafana Cloud (or other SaaS) exporter.

## No-op by default

If **`OTEL_EXPORTER_OTLP_ENDPOINT`** (and **`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`**) are unset:

- `instrumentation.ts` returns immediately
- the NodeSDK is **not imported or started** (no HTTP patches, no exporter, no startup cost)
- manual `withSpan()` helpers are OpenTelemetry API no-ops
- `proxy.ts` still mints a W3C `traceparent` and echoes **`x-trace-id`** next to **`x-request-id`** so support can correlate a response without a backend

Local `pnpm dev` / CI stay in this mode.

## Droplet: Alloy → Tempo

App containers already join `visatop_edge` (`scripts/blue-green-deploy.sh`). Run Alloy on that network and give it an OTLP HTTP receiver on **4318**.

In `/root/visatop/.env` (production) and `/root/visatop/.env.staging`:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4318
APP_ENV=production   # or staging — never use NODE_ENV here
# GIT_SHA is injected at `docker run` from the image tag sha-<gitsha>
```

Compose service DNS is `alloy`; `container_name` `visatop-alloy` also resolves. The receiver and tail-sampling live in [`deploy/observability/alloy/config.alloy`](../../deploy/observability/alloy/config.alloy) — see [`infra.md`](infra.md).

Either form of the endpoint is accepted; the SDK normalizes to the traces path:

| Env value | Exporter URL |
| --- | --- |
| `http://alloy:4318` | `http://alloy:4318/v1/traces` |
| `http://alloy:4318/v1/traces` | unchanged |

Optional override: `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` (wins over the base endpoint).

Shipped Alloy receive → Tempo (`deploy/observability/alloy/config.alloy`; tail sampling keeps ERROR, ≥2s, and 5%):

```alloy
otelcol.receiver.otlp "app" {
  http {
    endpoint = "0.0.0.0:4318"
  }
  output {
    traces = [otelcol.exporter.otlp.tempo.input]
  }
}

otelcol.exporter.otlp "tempo" {
  client {
    endpoint = "tempo:4317"
    tls {
      insecure = true
    }
  }
}
```

Point Grafana at the local Tempo datasource. Query by `service.name = visatop-next-js` and `deployment.environment` (`staging` | `production`).

### Local collector (optional)

For a laptop, run Alloy (or the OTel Collector) listening on `localhost:4318` and set:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
APP_ENV=development
```

Do not send staging/production traces off-box.

## Resource attributes

Set in `lib/observability/resource-attributes.ts` when the SDK starts:

| Attribute | Source |
| --- | --- |
| `service.name` | `OTEL_SERVICE_NAME` or `visatop-next-js` |
| `service.version` | `GIT_SHA` (deploy script, from `:sha-<gitsha>` image tag), else `RELEASE_SHA`, else `VISATOP_RELEASE_SHA` |
| `deployment.environment` | **`APP_ENV`** (`staging` / `production`). **Not** `NODE_ENV` (that is `production` on both slots). |

`blue-green-deploy.sh` passes `-e APP_ENV=<staging|production>` and `-e GIT_SHA=<sha>` on `docker run`.

## Sampling

App-level sampler is **parent-based + trace-id ratio** (OpenTelemetry `parentbased_traceidratio`):

- Incoming `traceparent` sampled flag is honored (so a collector or upstream can force a trace).
- Root spans (and proxy-minted contexts) use a ratio.

Env (either is accepted; ratio wins if both set):

```bash
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_RATIO=1
# or standard:
# OTEL_TRACES_SAMPLER_ARG=1
```

**Default ratio is `1` (always sample).** Traffic is low; head-sampling at 100% keeps webhook / OCR / payment traces. Leave the default unless volume grows.

### Tail sampling at Alloy (recommended)

Head sampling cannot know a span will error or run slow until it ends. Configure **tail sampling in Alloy** (or the Tempo metrics-generator / a collector processor) to:

- **keep** all traces with an error status
- **keep** traces slower than a threshold (e.g. 2s)
- **downsample** the remaining OK traces if storage grows

That is the right lever for cost, not lowering `OTEL_TRACES_SAMPLER_RATIO` on the app.

## Manual spans (safe attributes only)

| Span name | Where |
| --- | --- |
| `gemini.ocr.extract` / `gemini.ocr.call` | Passport OCR |
| `fincra.checkout.create` / `.verify` / `fincra.refund.initiate` | Fincra HTTP |
| `ziina.payment_intent.create` / `.get` / `ziina.refund.initiate` | Ziina HTTP |
| `paddle.checkout.create` / `paddle.refund.initiate` | Paddle SDK |
| `payments.webhook.{fincra,ziina,paddle}` | Webhook handlers |
| `mailgun.send` | Transactional email |
| `reconcile.{fincra,ziina}` and `.payment` | Internal cron |

Allowed attributes (allowlist in `lib/observability/span-attributes.ts`): `applicationId`, `paymentId`, `provider`, `status`, `errorCode`, `http.status_code`, `requestId`, `slot`, `outcome`, `attempt`, `operation`.

**Never** on spans, logs attached to spans, or `Server-Timing`: request/response bodies, headers, emails, names, passport fields, OCR text, payment card data.

HTTP auto-instrumentation is on (with query strings stripped and no header capture). `pg` / `pino` / filesystem instrumentations are off so SQL and log fields cannot leak PII.

## Correlating a request

1. Response headers: **`x-request-id`** and **`x-trace-id`** (32 hex chars).
2. `proxy.ts` also forwards W3C **`traceparent`** into the Node request so the SDK continues the same trace.
3. In Tempo, search `traceID = <x-trace-id>`.

`jsonOk` / `jsonError` also set `x-trace-id` when a recording span is active (SDK on). Pino `createRequestLogger(requestId)` binds the same `requestId` plus `traceId`/`spanId` from the active span so Loki lines join Tempo without copying IDs by hand.

## Env cheat sheet

| Variable | Role |
| --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Enable export; droplet value `http://alloy:4318` |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Optional full traces URL |
| `APP_ENV` | `staging` or `production` (resource `deployment.environment`) |
| `GIT_SHA` | Release SHA (`service.version`); set by deploy |
| `OTEL_TRACES_SAMPLER_RATIO` | Head sample ratio, default `1` |
| `OTEL_SERVICE_NAME` | Override service name |
| `OTEL_DIAGNOSTIC_LOGS=1` | Verbose SDK logs |

GlitchTip (`registerSentry` / `onRequestError`) and tracing (`registerTracing`) both live in `instrumentation.ts`. Structured logs keep `requestId`/`traceId`/`spanId`; responses keep `x-request-id` and `x-trace-id`. Tracing still does not import the NodeSDK until an OTLP endpoint is set. Droplet Alloy/Tempo compose: [`infra.md`](infra.md).
