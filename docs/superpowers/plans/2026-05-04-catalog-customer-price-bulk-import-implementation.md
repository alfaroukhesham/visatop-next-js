# Catalog customer prices — bulk XLSX + USD/AED — Implementation Plan

> **For agentic workers:** Implement task-by-task (checkboxes). Sub-skill: `superpowers:subagent-driven-development` or `superpowers:executing-plans` recommended. After each major phase run **`pnpm run lint && pnpm run test:ci && pnpm run build`** (per `ci-readiness.mdc`).

**Goal:** Replace affiliate reference + margin pricing with **`catalog_customer_price`** (nationality × service × currency), **FX** from **`NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD`**, **admin XLSX import** (preview → apply + optional pending-currency wizard), and **legacy table/code removal** per [spec](../specs/2026-05-04-catalog-customer-price-bulk-import-design.md).

**Architecture:** Pure **customer list prices** in DB; **materialize** FX-derived sibling currency rows on apply (recommended in spec) so catalog queries stay simple. **`visa_service_eligibility`** synced on apply: present when ≥1 **published** price for pair; removed when no published prices. **Public catalog** + **`POST /api/checkout`** call a **new resolver** (replace `resolveAdminPricingBreakdown` / `resolveClientDisplayPrice` usage for applications). **`price_quote.breakdown_json`** evolves to a **customer-price snapshot** (amount, currency, optional `fxRateUsed`, `fxLeg`).

**Tech stack:** Drizzle + new SQL migration(s), `sheetjs` or `exceljs` (pick one; prefer **no** `xlsx` full bundle if tree-shake concerns — decide in Task 2), Vitest, existing `jsonOk`/`jsonError`, **`export const runtime = "nodejs"`** on new admin routes.

**Product source:** [spec](../specs/2026-05-04-catalog-customer-price-bulk-import-design.md) §1–§10.

---

## Open product check (before coding)

- **Add-ons:** Today `listPublicServicesForNationality` adds **addon** minor units into display (`computeDisplayPriceMinor`). Spec locks **exact customer total** from the sheet. **Confirm:** checkout/catalog **ignores add-ons** for priced SKUs, or add-ons are removed from MVP — document decision in resolver.

---

## File map (expected touchpoints)

| Area | Action |
|------|--------|
| Schema | New `lib/db/schema/catalog-customer-price.ts` (+ `pending` table); extend `lib/db/schema/index.ts`; **remove** `affiliateReferencePrice`, trim `affiliate.ts` / `applications.ts` (`marginPolicy`) per migration |
| Migrations | New `drizzle/00xx_*.sql`: create `catalog_customer_price` (+ pending), RLS policies; **drop** `affiliate_reference_price`, `margin_policy`; **optional** `affiliate_site` — see Task 1 |
| Resolver | Replace/shrink `lib/pricing/resolve-catalog-pricing.ts`; add `lib/pricing/resolve-customer-catalog-price.ts` (or similar); **FX helpers** `lib/pricing/fx-usd-aed.ts` + tests |
| Catalog | `lib/catalog/queries.ts` — swap reference/margin path for customer price + FX |
| Checkout | `app/api/checkout/route.ts` — new resolver; **breakdown_json** shape |
| Admin API | Delete `app/api/admin/pricing/margin-policies/**`, `reference-prices/**`; add `app/api/admin/catalog/customer-prices/import/preview`, `.../apply`, `.../pending-currency` (names TBD) |
| Admin UI | `app/admin/(protected)/pricing/page.tsx`, `components/admin/pricing-workspace.tsx` — import wizard + remove margin/ref UI |
| Seeds / demo | `scripts/seed-demo-catalog.sql`, `pnpm db:seed:demo` path, `0015_catalog_aed_from_usd.sql` **superseded** — replace with inserts into `catalog_customer_price` or new seed migration |
| Env | `.env.example` — update comments; ensure **`NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD`** documented for **server** checkout (add **`FX_AED_PER_USD`** mirror if Next inlines `NEXT_PUBLIC_*` only on client — verify) |
| Docs | `docs/IMPLEMENTATION_REFERENCE.md` §2/§10 pricing bullets — align with customer-price model |
| Tests | New unit tests: parse header detection, cell currency, FX; integration: import apply + RLS; update `resolve-catalog-pricing.test.ts` or replace |

---

## Task 0: Dependency audit — `affiliate_site` / connectors

**Files:** `lib/db/schema/affiliate.ts`, drizzle SQL, ripgrep

- [ ] **Map FKs:** `affiliate_connector.site_id` → `affiliate_site.id`; `affiliate_reference_price.site_id` → `affiliate_site`; `automation_job` → `affiliate_connector`.
- [ ] **Decision (record in PR description):**
  - **0a)** If automation/connectors are **unused in prod:** migration can **drop** `affiliate_reference_price`, `margin_policy`, then **`affiliate_site`** + **`affiliate_connector`** (and fix `automation_job` if needed — or drop stub automation rows first).
  - **0b)** If connectors **remain:** drop **`affiliate_reference_price`** + **`margin_policy`** only; **keep** `affiliate_site` as non-pricing parent for connectors until a follow-up migration removes `site_id` from connectors.
- [ ] Spec §8 says remove `affiliate_site` — **implement 0a** only when FK-safe; else **0b** + follow-up issue to decouple connector from site.

---

## Task 1: Database — `catalog_customer_price` + pending + RLS

**Files:** `lib/db/schema/*.ts`, `drizzle/00xx_catalog_customer_price.sql`, `drizzle/meta/*` (via `pnpm drizzle-kit generate` if used)

- [ ] **`catalog_customer_price`:** columns per spec §3.1 (`nationality_code`, `service_id`, `currency`, `amount_minor` bigint, `source` text, timestamps). Unique `(nationality_code, service_id, currency)`. FKs to `nationality`, `visa_service`.
- [ ] **`catalog_customer_price_pending`:** `(id, nationality_code, service_id, amount_minor, batch_id or import_job_ref, created_at)` — currency assigned in wizard; **no public listing** until resolved.
- [ ] **RLS:** mirror catalog table patterns in `0003_catalog_addon_rls.sql` — admin `catalog.write` + `catalog.read`; **system** `SELECT` for enabled nationality/service joins (same spirit as `visa_service_eligibility_system_select`).
- [ ] **Drop legacy pricing tables** (per Task 0 outcome): at minimum **`affiliate_reference_price`**, **`margin_policy`**, policies in `0003_catalog_addon_rls.sql` that reference them.
- [ ] **Drizzle journal:** single new migration file id consistent with repo sequence.

---

## Task 2: Dependencies — XLSX parser

**Files:** `package.json`, `pnpm-lock.yaml`

- [ ] Add **`exceljs`** or **`xlsx`** (SheetJS); prefer **streaming** / workbook read from `Buffer` in route handler.
- [ ] No client bundle of parser — **server-only** import.

---

## Task 3: Pure functions — parse + FX

**Files:** `lib/admin/catalog/import-price-sheet.ts` (or `lib/catalog/import/`), `*.test.ts`

- [ ] **`detectHeaderRowIndex(rows, N=25)`:** first row containing normalized `#`, `Country`, and ≥1 other non-empty header (spec §5.1).
- [ ] **`normalizeCountryName` / `matchNationality`:** fuzzy rules as spec; unresolved → row error.
- [ ] **`parseMoneyCell(raw):`** `{ kind: 'priced', currency, amountMinor } | { kind: 'ambiguous', amountMinor } | { kind: 'empty' }`** — currency signals (USD, AED, `$`, agreed list).
- [ ] **`fxUsdToAed` / `fxAedToUsd`:** read rate from **`process.env.NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD`** or server mirror; **parse float**; guard missing/invalid → clear error at checkout/import when FX needed.
- [ ] **Rounding:** single helper; tests for boundary minors.
- [ ] **Vitest** fixtures: small **.xlsx** in `test/fixtures/` or build workbook in-memory with parser lib.

---

## Task 4: Import apply logic (transactional)

**Files:** `lib/admin/catalog/apply-customer-price-import.ts`

- [ ] Input: parsed grid + admin user id + optional `batchId`.
- [ ] For each **unknown service header:** `INSERT visa_service` (name trimmed, enabled, nullable duration/entries defaults).
- [ ] For each **priced** cell with currency: upsert `catalog_customer_price`; then **materialize** missing AED/USD sibling with `source` fx-derived; collect **autoFix[]** for response/audit.
- [ ] **Ambiguous** cells: insert `catalog_customer_price_pending` (no eligibility, not listed).
- [ ] **Empty** cell: `DELETE` both currency rows for `(nationality, service)`; `DELETE visa_service_eligibility` for pair.
- [ ] **Eligibility sync:** after published prices for pair, `INSERT` eligibility if not exists; if no published prices, delete eligibility.
- [ ] **`writeAdminAudit`:** summary JSON: file hash, row counts, `autoFix`, `servicesCreated[]`, errors.
- [ ] All inside **`withAdminDbActor`** transaction.

---

## Task 5: Admin API routes

**Files:** `app/api/admin/catalog/customer-prices/import/preview/route.ts`, `apply/route.ts`, `pending-currency/route.ts` (adjust paths to taste)

- [ ] **`POST .../preview`:** `multipart/form-data` file; parse; return `jsonOk({ headerRowIndex, errors[], pending[], autoFixPreview[], stats })` — **no writes**.
- [ ] **`POST .../apply`:** body with **client token** or re-upload + hash match spec optional — MVP: **require** preview response hash or re-parse same file (document replay risk); **all-or-nothing** on validation errors.
- [ ] **`POST .../pending-currency`:** bulk set currency for pending rows → promote to `catalog_customer_price` + run FX materialization + eligibility.
- [ ] Permissions: **`catalog.write`** + **`audit.write`** (align with spec §5.6); reuse `runAdminDbJson` pattern from existing admin routes.
- [ ] **`export const runtime = "nodejs"`** on every new `route.ts`.

---

## Task 6: Resolver + catalog public API

**Files:** `lib/pricing/resolve-customer-catalog-price.ts`, `lib/catalog/queries.ts`, `app/api/catalog/**` if any inline pricing

- [ ] **`resolveCheckoutTotal(tx, { nationalityCode, serviceId, catalogCurrency })`:** returns `{ displayMinor, currency, breakdown }` using stored rows + FX; **null** if not offered.
- [ ] Replace **`listPublicServicesForNationality`** implementation: join `catalog_customer_price` / eligibility per spec; **no** `resolveCanonicalAffiliateSiteId`, **no** `batchLatestReferencesForServices`, **no** margin.
- [ ] **`nationality` list query:** still `exists(eligibility)` **or** switch to **exists(customer price)** — align with spec “offered = published price” (may require query change from eligibility-only).

---

## Task 7: Checkout + `price_quote`

**Files:** `app/api/checkout/route.ts`, consumers of `breakdown_json` (grep)

- [ ] Swap **`resolveAdminPricingBreakdown`** for **`resolveCheckoutTotal`** (or merged helper).
- [ ] **`breakdown_json`:** store `{ kind: 'customer_catalog', amountMinor, currency, fxRate?: string, fxLeg?: 'usd_from_aed' | 'aed_from_usd' | null }`** — update any email/report readers that parsed old `referenceMinor` / `marginMode`.
- [ ] **Guest metadata / Paddle:** keep `applicationId`, `serviceId`, `priceQuoteId`, `catalogCurrency` — ensure totals match locked quote.

---

## Task 8: Remove legacy code paths

**Files:** `lib/pricing/resolve-catalog-pricing.ts`, `lib/pricing/compute-display-price.ts` (trim if unused), `app/api/admin/pricing/**`, `components/admin/pricing-workspace.tsx`, tests

- [ ] Delete or gut **`resolve-catalog-pricing.ts`** exports used only for old pricing; update **`resolve-catalog-pricing.test.ts`** accordingly.
- [ ] Remove **margin / reference** API routes and **admin UI** cards.
- [ ] Grep **`PRICING_AFFILIATE_SITE_ID`**, **`affiliateReferencePrice`**, **`marginPolicy`** — zero references outside historical migrations.

---

## Task 9: Admin UI — import + wizard

**Files:** `components/admin/customer-price-import.tsx` (new), `pricing-workspace.tsx`, `pricing/page.tsx`

- [ ] **Upload** → call preview → render errors, **pending currency** table, **services to create**, **FX auto-fix** list (spec §6).
- [ ] **Apply** button (disabled if blocking errors).
- [ ] **Wizard:** select USD vs AED for all pending (or per row) → POST pending-currency → refresh.
- [ ] **Copy:** highlight spec §3.3 admin messaging (one currency ⇒ offered in both; FX fills gap).

---

## Task 10: Seeds, demo data, CI

**Files:** `scripts/seed-demo-catalog.sql`, `drizzle/*`, `package.json` scripts

- [ ] Update **demo seed** to insert **`catalog_customer_price`** (+ eligibility) instead of affiliate reference / margin.
- [ ] Remove or rewrite **`0015_catalog_aed_from_usd.sql`** references for **fresh** environments (historical migrations stay; new clones use new seed only — document).
- [ ] **DB integration tests:** if `RUN_DB_TESTS=1`, extend or add test for RLS on new table.

---

## Task 11: Documentation + env

**Files:** `.env.example`, `docs/IMPLEMENTATION_REFERENCE.md`

- [ ] **`.env.example`:** per spec self-review — **`NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD`** comment = customer catalog + checkout; remove obsolete affiliate pricing blurbs.
- [ ] **Implementation reference:** Phase 1 pricing bullets → customer price + import; remove margin/reference as current model.

---

## Task 12: Verification gate

- [ ] `pnpm run lint`
- [ ] `pnpm run test:ci`
- [ ] `pnpm run build`
- [ ] Manual: import `Price_template_v01.xlsx`, preview, apply, checkout USD and AED paths.

---

## Suggested implementation order

1. Task 0 → Task 1 → Task 2  
2. Task 3 → Task 4 (unit-tested helpers first)  
3. Task 6 (resolver) → Task 7 (checkout) — **unblocks** runtime without UI  
4. Task 5 → Task 9  
5. Task 8 (delete dead code after new paths green)  
6. Task 10 → Task 11 → Task 12  

---

## PR / commit strategy

- **Option A (single PR):** One large PR with migration + feature + deletion (review heavy).
- **Option B (stacked):** PR1 migration + schema + resolver + catalog/checkout; PR2 admin import + UI; PR3 legacy deletion + doc — **recommended** for reviewability.

---

## Links

- [Design spec](../specs/2026-05-04-catalog-customer-price-bulk-import-design.md)
- [`lib/catalog/queries.ts`](../../../lib/catalog/queries.ts)
- [`app/api/checkout/route.ts`](../../../app/api/checkout/route.ts)
