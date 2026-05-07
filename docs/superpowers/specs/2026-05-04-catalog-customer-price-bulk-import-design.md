---
title: Catalog customer prices — bulk XLSX import + USD/AED (no affiliate pricing path)
date: 2026-05-04
status: Draft — pending product review
related:
  - docs/IMPLEMENTATION_REFERENCE.md (admin import direction; no price scraping)
---

## 1) Intent (locked)

- **Commercial catalog** is **nationality + service + final customer price** (per currency where stored). Admins maintain prices via **bulk XLSX** using the standard wide template (`Price_template_v01.xlsx` family): columns **`#`**, **`Country`**, then one column per visa service. **Header row is detected**, not assumed at a fixed index — see **§5.1**.
- **Non-empty cell** (with resolvable amount and, when required, currency — see **§5.2**) = we **sell** that service to that nationality; checkout uses the **locked quote** amount in the currency the customer pays in.
- **Empty cell** for a nationality×service = **no price in either currency** for that pair from this import → **delete** all stored customer prices for that pair and **delete `visa_service_eligibility`** for that nationality+service so it is **not offered**.
- **No** affiliate scrape. **`affiliate_reference_price`**, **`margin_policy`**, and **`affiliate_site`** (and related pricing code) are **removed** from schema and codebase as part of this delivery (see **§8**); nothing “transitional” remains for customer pricing.
- **Currencies:** **USD** and **AED** are both **first-class**. **FX rate** uses the existing environment variable documented in **`.env.example`**: **`NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD`** = **AED per 1 USD** (same semantics for server-side resolution and locking; if build constraints require a server-only duplicate, keep **one** configured value in ops docs — no separate DB FX table required for v1).
- **Single-currency upload:** If the admin has a price in **only USD** or **only AED** for a `(nationality, service)`, the system **still offers** the SKU in **both** currencies: the missing side is filled using **`NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD`** (USD→AED) or its **inverse** (AED→USD). This is an **auto-fix**; the import/apply summary and admin UI must **list these fills explicitly** (e.g. “Derived AED from USD via FX”, “Derived USD from AED via inverse FX”) so admins see what was automated. **Data integrity is the admin’s responsibility**; the system only fills the missing currency from the configured rate.
- **Neither currency** stored for a pair after import rules run = **not offered** (no eligibility, no customer price rows).
- **Quote lock:** Persist **currency**, **amount in minor units**, and **FX rate snapshot** when a value was derived from the other currency at quote time.

## 2) Current state (problem)

- Pricing resolution today centers on **`affiliate_reference_price`**, **`margin_policy`**, and **`affiliate_site`** (`lib/pricing/resolve-catalog-pricing.ts`).
- **Eligibility** is `visa_service_eligibility` (nationality + service) without customer-facing final price per nationality.
- Admin pricing UI is **margins + reference CRUD**, not bulk nationality×service customer prices.

This spec **replaces** that model end-to-end.

## 3) Target data model

### 3.1 Primary table (new)

Introduce **`catalog_customer_price`** (exact name implementation-defined), with at minimum:

| Field | Purpose |
|--------|--------|
| `nationality_code` | FK to `nationality.code` |
| `service_id` | FK to `visa_service.id` |
| `currency` | `USD` \| `AED` — **required on published rows**; see **§5.2** for pre-publish / pending state |
| `amount_minor` | Final customer total in minor units (integer) |
| `source` | e.g. `admin_import` \| `admin_ui` \| `fx_derived_usd_from_aed` \| `fx_derived_aed_from_usd` — audit and admin transparency |
| `created_at` / `updated_at` | Standard timestamps |

**Unique constraint:** `(nationality_code, service_id, currency)`.

**Offered semantics:** A service is **offered** to a nationality **iff** there is at least **one published** `catalog_customer_price` row (non-pending) for that `(nationality, service)` after apply/wizard. The **other** currency is always **available** at catalog/checkout via **§4** (explicit row or FX fill from **`NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD`**). **Pending** rows (amount without assigned currency) **do not** count as offered until the admin completes the **mass currency** step. Eligibility **exists** when offered; **removed** when the pair has **no** published prices (e.g. empty Excel cell per **§5.4**).

### 3.2 FX configuration

- **Reuse** **`.env.example`**: **`NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD`** (AED per 1 USD). Use the **inverse** (1 AED in USD, or divide by rate as documented in implementation) when **only AED** is present and **USD** must be auto-filled.
- **No** automated FX scraping. Rate changes are **env/deploy** (or future admin UI that writes config the app reads — optional); v1 is **env-driven** only.
- Import/apply and checkout **log or embed** the rate used in **audit** / **price_quote** when a value was FX-derived.

### 3.3 Eligibility (`visa_service_eligibility`)

- **Sync with “offered”:** When a `(nationality, service)` **has at least one** stored customer price row that makes it sellable (after currency wizard completion for ambiguous imports — see **§5.2**), **ensure** an eligibility row exists. When **no** price remains for that pair (**empty cell** after apply, or both rows removed), **delete** eligibility for that nationality+service.
- **Admin messaging (highlight):** If a price exists in **one** currency, the system **treats the SKU as eligible** and **surfaces it in both USD and AED**; the **missing** stored amount is **computed from `NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD`** until the admin uploads an explicit second currency. Call this out in **preview**, **apply summary**, and **in-app help** next to import.

## 4) Currency resolution rules

| Situation | Rule |
|-----------|------|
| **Both** USD and AED rows exist | Use each for its currency; no conversion for that side. |
| **USD only** | USD from row; AED = `fx(USD → AED)` using **`NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD`**. **Auto-fix** visible to admin. |
| **AED only** | AED from row; USD = `fx(AED → USD)` using **inverse** of the same env rate. **Auto-fix** visible to admin. |
| **Neither** | **Not offered**; no catalog row; no checkout. |

**Quote creation:** Snapshot **amount**, **currency**, and **rate** (if any leg was derived) on `price_quote`.

**Rounding:** One global rule; unit tests for edge minors.

## 5) XLSX import (standard template)

### 5.1 Parsing and header guard

- Use a server-side XLSX parser (buffer from multipart upload).
- **Do not assume** headers live on a fixed row index. **Scan** the first **N** rows (recommend **N ≥ 25**) and select the **first row** that simultaneously contains the required markers (after trim/normalize): a **`#`** column, a **`Country`** column, and **at least one** additional non-empty header (service column). Use **that row** as the **header row**; all rows below are data until a stop rule (e.g. blank `Country` for remainder optional).
- **Trim** header strings when matching to `visa_service.name` and when comparing `#` / `Country` labels.
- Map **`Country`** → `nationality.code` via **`nationality.name`** (normalized); unresolved → **validation error** for that row.

### 5.2 Cell values, currency detection, and ambiguous amounts

- **Currency in cell:** If the cell text includes a **parseable currency signal** (e.g. `USD`, `AED`, `$`, `د.إ`, or agreed patterns), parse **amount_minor** and **currency** and upsert **`catalog_customer_price`** for that `(nationality, service, currency)`.
- **No currency signal:** **Do not assume USD.** **Create** the numeric value in a **post-import wizard** path: e.g. **`catalog_customer_price_pending`** (or equivalent) holding `(nationality_code, service_id, amount_minor, row_ref)` with **`currency` unset**. **Preview** lists all such cells; **Apply** either (product choice — **recommend:**) **blocks apply** until preview is clean, **or** applies known-currency rows and leaves pending for wizard — spec **requires** that **nothing is customer-visible as “priced”** until **`currency` is set** for every pending row in that batch (admin **mass-assign currency** step: choose USD or AED for all pending, or per row).
- After any single-currency row is **published**, run **§4** auto-fill for the other currency (materialized row with `source` = fx-derived) **or** compute-only at quote time — **recommend materialize** for simpler catalog queries; either way **admin summary lists auto-fixes**.

### 5.3 Unknown service columns

- If a column header does **not** match an existing **`visa_service.name`** (after trim): **create** a new **`visa_service`** row (`name` = header text, sensible defaults for other fields), then map prices and eligibility for that new `service_id` like any other column.

### 5.4 Empty cells and eligibility

- **Empty** nationality×service cell (no parseable amount): treat as **remove all customer price rows** for that pair for this import scope and **delete `visa_service_eligibility`** for that nationality+service.
- Reiterate in **UI copy**: empty = **not offered**; partial currency coverage + FX = **offered in both** with missing side filled from env rate until explicit second currency is uploaded.

### 5.5 Preview vs apply

- **Preview:** full parse, header row used, row-level errors, **auto-fix list** (FX fills), **pending currency list**, counts — **no DB writes** (except optional ephemeral session storage — prefer stateless preview payload).
- **Apply:** transactional writes: services created, prices upserted/deleted, eligibility synced, audits — **`audit_log`** includes file hash, actor, counts, and **explicit list of auto-fixed FX rows**.

### 5.6 API / security

- **`POST`** under `app/api/admin/...`, **`export const runtime = "nodejs";`**.
- **`runAdminDbJson`** / `withAdminDbActor`; permissions **`catalog.write`** + **`audit.write`** (align names in implementation plan).
- **`jsonOk` / `jsonError`** + **`x-request-id`**.

## 6) Admin UI

- **Import customer prices:** template download → upload → **Preview** (show header row detected, unknown services to be created, **pending currency** rows, **FX auto-fixes**) → optional **mass currency wizard** → **Apply**.
- Surface **warnings** for every **inverse FX** (AED-only → USD) and **forward FX** (USD-only → AED) auto-fill.
- **FX** for v1: document that ops set **`NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD`** in env; optional later UI to override without redeploy.

## 7) Client catalog + checkout (behavioral)

- **Public catalog** and **`POST /api/checkout`** resolve price **only** from **`catalog_customer_price`** + **§4** rules + **quote lock**. No reference/margin/affiliate code paths remain.

## 8) Legacy removal (required in same delivery)

- **Remove** (migrations + code): dependence on **`affiliate_reference_price`**, **`margin_policy`**, **`affiliate_site`** (and any pricing-only **`affiliate_*`** artifacts tied to the old model), admin CRUD for margins/reference, and **`PRICING_AFFILIATE_SITE_ID`** usage for pricing.
- **Replace** `lib/pricing/resolve-catalog-pricing.ts` (or equivalent) with resolver(s) that read **`catalog_customer_price`** and env FX only.
- **Clean** `.env.example` comments that describe the removed affiliate pricing knobs; keep **`NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD`** as the **canonical FX** knob (update comment to: customer catalog + checkout AED/USD conversion, not “display-only tabs for reference prices”).
- **Order of operations:** introduce `catalog_customer_price` + new resolver → switch catalog/checkout → remove legacy tables in a migration after code no longer references them (single coordinated release acceptable if downtime window is acceptable; otherwise expand/contract migrations per team practice).

## 9) Non-goals (YAGNI)

- Scraping FX or partner sites for rates or prices.
- Per-user dynamic discounting in the import path.
- Changing payment provider webhook semantics beyond locking the resolved **`price_quote`** amount and existing metadata contracts.

## 10) Testing and acceptance criteria

- **Unit:** Header-row detection across fixtures (title row only, header on row 3, etc.); trim matching; FX forward and inverse; rounding; currency parse from cell strings.
- **Integration:** unknown service column → new `visa_service`; preview → apply; empty cell → prices removed + eligibility deleted; AED-only row → USD auto-fill listed; wizard assigns currency for ambiguous cells before go-live.
- **Acceptance:**
  - Import succeeds when required headers appear on a **non-fixed** row.
  - **AED-only** stored price yields **listed USD** via inverse FX with **admin-visible auto-fix** line.
  - **Neither** currency for a cell → **not offered**, eligibility removed.
  - Checkout **locks** amount + currency + rate snapshot when FX used.

## 11) Follow-up

After this spec is **approved**, create an implementation plan via **writing-plans** (migrations for new table + legacy drops, resolver, routes, admin UI + wizard, tests).

---

## Spec self-review (inline)

- **Env:** **`NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD`** reused from **`.env.example`**; **`.env.example`** comment updated to describe customer AED/USD conversion (not legacy reference tabs).
- **Consistency:** Offered = ≥1 **published** price; pending currency excluded; empty cell → no prices + delete eligibility; single-currency → dual-currency via FX with **admin-visible auto-fix** list.
- **Scope:** Includes **legacy affiliate/margin/reference removal** in same delivery.
- **Ambiguity:** FX fill **materialized vs compute-only** — **recommend materialize**; plan decides.
