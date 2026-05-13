---
title: API observability, load testing, and HTTP correctness matrix (Neon branch)
date: 2026-05-12
status: Draft — pending product / engineering review
related:
  - instrumentation.ts (OpenTelemetry NodeSDK)
  - docs/IMPLEMENTATION_REFERENCE.md (API envelope, RLS, actor context)
  - .cursor/rules/visa-api-response-envelope.mdc
---

## 1) Intent (locked)

Deliver **two complementary layers** against a **dedicated Neon database branch** (isolated `DATABASE_URL`), with a running Next.js app instance pointed at that branch:

1. **Performance discovery:** identify **slow HTTP endpoints** under controlled load (primary tool: **k6**), with **per-route** aggregates (p50 / p95 / p99, errors) and clear tagging.
2. **Per-request attribution for slow calls:** for requests that exceed configurable thresholds, provide a **trace of which coarse phase consumed time** inside the server process, using:
   - **OpenTelemetry** (spans / trace waterfall) as the **authoritative** breakdown when an OTLP endpoint is configured, and
   - **`Server-Timing`** response headers as a **lightweight, HTTP-visible** summary for quick inspection and for k6-side logging without opening a trace UI.

3. **Correctness matrix (full read/write coverage intent):** an **HTTP-level** test suite (black-box against `BASE_URL`) that exercises **every** `app/api/**/route.ts` handler method that is **eligible for automation**, with explicit **exclusions** and **fixtures** documented in a **route manifest**. This complements existing **Vitest** route tests (mock-heavy) rather than replacing them.

**Security and privacy (non-negotiable):**

- Do **not** attach **PII**, document payloads, OCR output, payment card data, or raw webhook bodies to spans, logs, or `Server-Timing` descriptions.
- Keep **OTel** posture aligned with existing `instrumentation.ts` discipline: minimal attributes; no capture of request/response headers or bodies in instrumentation hooks.
- `Server-Timing` uses **generic phase names** only (examples: `auth`, `db`, `external`, `serialize`). No customer identifiers in header values.

## 2) Current state

- **OpenTelemetry:** `instrumentation.ts` registers `@opentelemetry/sdk-node` with `@opentelemetry/auto-instrumentations-node`, optional **OTLP HTTP** exporter when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, and defensive HTTP hooks that avoid request-derived attributes beyond a safe marker.
- **Unit / route tests:** Vitest tests colocated with many routes; typical pattern mocks `next/headers`, `@/lib/auth`, and `@/lib/db/actor-context` — strong for logic, weak for **integration** of auth + RLS + real DB + HTTP edge cases.
- **Integration tests:** `tests/integration/` and gated env vars (e.g. `RUN_DB_TESTS=1`, real `DATABASE_URL`) for selected flows.
- **Load testing:** no k6 (or equivalent) harness or route manifest in-repo today.

## 3) Goals and non-goals

### 3.1 Goals

- **G1 — Slow endpoints:** produce a repeatable report ranking endpoints by latency percentiles and error rate under defined k6 scenarios.
- **G2 — Slow-call breakdown:** for requests over thresholds, engineers can see **coarse phase durations** via `Server-Timing` **and** deep causality via **OTel** spans (subject to instrumentation coverage — see section 7).
- **G3 — Regression safety:** HTTP matrix asserts **status codes**, **JSON envelope shape** (`jsonOk` / `jsonError`), and **stable error codes** where applicable; mutating tests use **branch-local fixtures** and cleanup rules.
- **G4 — Isolation:** all writes target the **Neon branch** and **non-production** secrets for external providers in test mode.

### 3.2 Non-goals (v1)

- Replacing Vitest mocks with 100% real-DB unit tests for every handler in the same PR as the harness (optional follow-up).
- **Production** load testing against production URLs or production Paddle / payment environments.
- **Sub-millisecond** micro-profiling of every function; v1 is **coarse phases** plus whatever **auto-instrumentation** and **explicit spans** cover.
- Capturing **affiliate margin** or internal cost breakdown in client-visible headers or traces (product rules forbid surfacing this to clients; observability must not become a leak channel).

## 4) Architecture overview

| Concern | Mechanism |
|---------|-----------|
| Isolated data | Neon **branch** connection string; migrations applied; optional seed scripts for matrix fixtures |
| Running SUT | `next start` (local or preview/staging deploy) with env pointing at Neon branch |
| Slow endpoint ranking | **k6** scenarios + **tags** per manifest entry + exported summary (JSON) |
| Wire-visible phase hint | **`Server-Timing`** behind env (e.g. `PERF_SERVER_TIMING=1`) in non-prod and perf environments |
| Authoritative internal trace | **OTel** OTLP export + trace backend (operator-chosen: Jaeger, Tempo, Grafana Cloud, etc.) |
| Correlation | Existing **`x-request-id`** header convention; propagate on client (k6 / HTTP matrix) and optionally attach to spans only if policy allows (must remain non-PII) |

**Dual signal (locked choice C):** k6 proves **which URL patterns are slow under load**; OTel explains **why inside the process**; `Server-Timing` gives a **fast per-response snapshot** aligned with those same requests.

## 5) Route manifest (source of truth for coverage)

### 5.1 Generation

- Add a **maintained artifact** listing every automated test case: `METHOD`, path pattern, **auth fixture** id, **body strategy** (none / fixture file / generator), **expected** minimal assertions (status class, envelope type), and **k6 eligibility** (boolean: safe under concurrent load).
- **Primary input:** filesystem scan of `app/api/**/route.ts` (or build-time script emitting JSON) **plus** manual rows for dynamic segments (IDs from fixtures).
- **Review rule:** PRs that add or change `route.ts` files must update the manifest or CI fails (generator diff check).

### 5.2 Exclusions (must be explicit in manifest with reason)

Examples (exact list implementation-maintained):

- **Webhooks** unless the suite uses **recorded payloads** and **valid signatures** from **test-only** secrets (`PADDLE_*` / Ziina test mode); never replay arbitrary production webhooks.
- **Internal / cron** routes (e.g. draft cleanup) unless the test environment injects the **expected system secret** and the operation is idempotent on branch data.
- **Destructive admin** operations unless each run uses disposable entity IDs created in setup.

### 5.3 Auth fixtures

- **Guest:** resume cookie / guest flows per existing cookie rules.
- **Client:** Better Auth session obtained once per suite run (mechanism implementation-defined: login API, seeded password user, or cookie jar from playwright-style login — must not commit secrets).
- **Admin:** session for a user with known RBAC fixture on the Neon branch (seed migration or setup script).

## 6) Layer 1 — HTTP correctness matrix

### 6.1 Execution model

- Start the app with **Neon branch** `DATABASE_URL` and required env for **test** payment providers.
- A Node-based HTTP client (implementation choice: undici, `fetch`, or similar) reads the **manifest** and runs cases **sequentially or in controlled parallel** where safe.
- Assertions:
  - HTTP status
  - Response is JSON and matches **envelope** helpers (`jsonOk` / `jsonError`) patterns
  - **`x-request-id`** present on responses when required by project rules
  - Optional: shallow schema checks for stable fields (avoid overfitting full payloads)

### 6.2 Writes and cleanup

- Each mutating case declares **setup** (create parent row) and **teardown** or uses disposable prefixes (e.g. unique email) so the branch stays usable across runs.
- Prefer **API-driven** setup when it exercises the same auth path as production.

## 7) Layer 2 — k6 load testing

### 7.1 Scenarios

- **Smoke:** 1 VU, validates liveness and baseline timings; always run first.
- **Stepped load:** only for manifest entries marked `k6_eligible: true` (mostly **GET** catalog, **read** portal lists, idempotent reads).
- **Write stress:** optional, **low concurrency**, dedicated fixture pools — not blanket max-VU on every POST.

### 7.2 Outputs

- k6 **summary** with thresholds (e.g. `http_req_duration` p95) **per tag** (route template).
- Export **JSON** summary for CI artifacts or nightly comparison.

### 7.3 Slow endpoint identification

- Tag = normalized route template (e.g. `GET /api/catalog/services`).
- Fail CI (optional) or open ticket when p95 regresses beyond budget for **golden** routes.

## 8) `Server-Timing` (HTTP-visible phases)

### 8.1 Activation

- Emitted only when **`PERF_SERVER_TIMING=1`** (or equivalent single env) **and** not in production deployment class, unless product explicitly approves production sampling later (default **off** in prod).

### 8.2 Content

- Phases are **coarse** and **bounded in count** (recommend ≤5 per response).
- Values are **durations in milliseconds** per RFC 6797 semantics for `Server-Timing`.
- Optional `desc` must be **generic** (no user content).

### 8.3 Implementation shape (non-binding)

- Shared helper (e.g. small timer API) used by selected handlers first (pilot), then rolled out to high-traffic routes; **not** required to wrap every route on day one if pilot proves pattern.

## 9) OpenTelemetry extensions

### 9.1 Exporter

- Perf / Neon-branch environments set `OTEL_EXPORTER_OTLP_ENDPOINT` (and vendor auth vars if required) so traces **export** during k6 runs.

### 9.2 Coverage gaps

- Validate whether **auto-instrumentation** captures **Neon serverless** / Drizzle query boundaries. If spans are missing or too coarse, add **explicit spans** around:

  - `withClientDbActor` / `withAdminDbActor` / `withSystemDbActor` transaction scopes (name = high-level operation, no SQL text, no params).

### 9.3 Correlation

- Standardize on **`x-request-id`** in k6 default headers.
- Trace backend queries filter by service name + route attribute (implementation adds **low-cardinality** `http.route` or custom `app.route_template` where appropriate).

## 10) CI and scheduling

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Vitest (existing) | every PR | Fast unit + mocked route tests |
| HTTP matrix (subset) | PR optional or nightly | Critical path regression on Neon branch |
| HTTP matrix (full) | nightly | Full coverage against branch |
| k6 smoke | nightly or on-demand | Slow endpoint baseline + `Server-Timing` capture on slow threshold |
| k6 load | manual / weekly | Heavier scenarios; requires operator approval |

**Cost control:** Neon branch + collector egress + CI minutes must be budgeted; k6 full load stays **off** default PR path unless stabilized.

## 11) Success criteria

- **SC1:** Given a Neon branch and OTLP backend, a single documented command sequence runs **k6** and produces a **sorted report** of route templates by p95 latency.
- **SC2:** For artificially slowed pilot routes, **`Server-Timing`** and OTel spans both reflect increased duration in the **same phase** (pilot validates correlation).
- **SC3:** HTTP matrix covers **100%** of manifest-eligible handlers; excluded routes are listed with reasons; manifest generator fails CI on drift.
- **SC4:** No new telemetry path logs or exports **PII** or payment artifacts (review checklist in PR template).

## 12) Open items (implementation phase)

- Exact **auth bootstrap** for Better Auth in the HTTP matrix (cookie jar vs token).
- Choice of **trace backend** for local dev (docker-compose vs cloud).
- Whether k6 sends **`traceparent`** for stronger join (optional enhancement after baseline works).

## 13) Next step after approval

- User reviews this file; after any edits, **implementation plan** is produced via the **writing-plans** workflow (separate doc under `docs/superpowers/plans/`).
- **Git:** do not commit this spec until the user explicitly approves commit (repo convention).
