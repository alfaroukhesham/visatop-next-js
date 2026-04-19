# Visa platform — design (brainstorm consolidation)

**Status:** Draft from facilitated brainstorm  
**Date:** 2026-04-07  
**Aligns with:** [`PRODUCT_REQUIREMENTS.md`](../../PRODUCT_REQUIREMENTS.md), [`DESIGN.md`](../../DESIGN.md)

**Implementation conventions:** [`docs/IMPLEMENTATION_REFERENCE.md`](../IMPLEMENTATION_REFERENCE.md)

## Executive summary

Build a **nationality-first** visa funnel (guest or signed-in): **select nationality → choose visa service → upload documents → OCR/AI extraction → Paddle checkout → reference + email**. **Admins** control **products**, **eligible nationalities**, **pricing**, **enable/disable**, and **operational actions** (refunds/credits/reject/accept with audit). **Reference pricing and rich catalog details** come from **admin-uploaded CSV/Excel** (validated, audited bulk updates) — **not** from **web scraping** third-party sites. **Ops fulfillment** (manual steps outside the app, partner payments, authority submissions) remains **manual-first**, with **manual completion** and **tiered internal proof** as **first-class**. **Internal** economics (cost vs client payment vs margin) stay **off** client-visible surfaces; client sees **simple status** and **neutral** copy when work is with humans.

## Non-goals / risks (explicit)

- **No third-party price scraping** or scheduled “sync from affiliate website” jobs; **mitigation:** **file-based** catalog and reference-cost updates by admins.
- **No guarantee** of stable **external** automation if we later add browser or partner integrations: **layout changes**, **CAPTCHAs**, **anti-bot**, **sessions**, and **ToS** remain risks. **Mitigation:** per-product **kill switch**, **observability**, **manual fallback**, **no auto-refund** on failure (ops decides).
- **Partner / authority interactions** may still require **legal review** per jurisdiction and contract.

## Key product decisions (locked in brainstorm)

| Topic | Decision |
|--------|-----------|
| Reference pricing + catalog source | **Admin CSV/XLSX import** (validated, audited); **no** scraping third-party sites for prices |
| Money flow | **A** — Client pays **MoR (Paddle)** the **all-in** price; **company/ops** pays affiliate from **operational funds**; margin internal |
| Refunds / reversals | **D** — **Flexible admin intents** (refund / credit / reject-without-refund) with **audit**; details governed by policy + MoR rules |
| Automation failure after client paid | **B** — **No auto-refund**; ops **decides**; client sees **clear status**; ops may **manually** complete and mark **manual success** |
| Proof on manual success | **D** — **Tiered** by product/value; **internal** confirmation of affiliate payment vs client payment; **client** sees **high-level** states (e.g. specialist handling → awaiting authority), **not** margin breakdown |
| Transactional email content | **D** — **Principles + per-template** copy; **MoR** remains receipt owner; product emails emphasize **next steps + tracking** |
| Payments architecture | **C** — **Provider abstraction**; **Paddle** first concrete adapter |
| Guest browser storage | **D** — **Threat model** first; **default stance:** **server-authoritative** drafts + **resume token** in **localStorage**; **avoid** storing **passport/OCR** in localStorage |
| Guest draft TTL | **D** — **Admin-configurable** global + per-product override |
| Reference data updates | **Business cadence** via **admin import** (and direct admin UI edits where applicable); optional **import job** with **progress**, **row errors**, and **notify stakeholders** when reference costs change |
| Re-pricing vs drafts | **D (hybrid)** — **Before Paddle checkout / firm intent:** prices can **move up** when reference cost rises (**no** long-lived “old low” promise). **After payment intent:** **freeze** charged amount. **Admin** can apply **discounts/overrides** with **audit** + **soft thresholds** |
| Discount authority | **D** — Start with **audit + reason** + **warnings** above thresholds; evolve to roles/dual control later |
| MVP scope | **D** — **Phased roadmap**; catalog/pricing maintained via **imports + admin UI**; fulfillment **manual-first** |
| Ops automation rollout | **N/A for price scraping** — scraping-based pricing is **cancelled**. Optional future tooling for ops (e.g. assisted workflows) is **out of MVP** unless explicitly scoped later |
| Partner / site bookkeeping | **D** — Data model may still track **which partner or tariff row** a service maps to for **internal** ops; **not** for live scraping |
| Nationality picker | **A** — Show **only** nationalities with **≥1** active product; helper note if country missing = **no route yet** |
| Demand capture | **A** — **Notify-me** short form (email + country + optional interest) → **admin review** |

## Client journey (MVP target)

1. **Nationality** — Searchable list **filtered to actionable** nationalities; helper copy; **notify-me** if missing.  
2. **Visa service** — Pick variant (e.g. 30-day single, 60-day multi).  
3. **Documents** — Upload; **OCR/AI** fills/review fields.  
4. **Payment** — **Paddle** checkout (via abstraction); on success: **reference** + **email**; **internal** ledger updated.  
5. **Optional account** — Guest may **sign up** to **track** in dashboard.  
6. **Statuses (client-facing)** — Avoid exposing **internal economics**; use **neutral** language for **manual/specialist** handling → **awaiting authority decision**.

## Admin / ops journey

- **Catalog:** Visa **types**, **eligible nationalities**, **prices** derived from **reference + margin rules**, **enable/disable**.  
- **Imports:** **CSV/XLSX** uploads for **bulk** updates to services, reference costs, and related columns; **validation** + **audit**; optional **notify** on material price changes after import.  
- **Fulfillment:** **Manual-first** ops workflows; **manual success** with tiered **internal** proof; client status **does not** reveal cost vs margin.  
- **Money ops:** **Refund/credit/reject** flows with **audit**; integrate **Paddle** refunds where applicable.

## Architecture notes (high level)

- **Payments:** `PaymentProvider` interface: checkout session, webhooks → **normalized domain events**, refunds, idempotency. **Paddle** adapter first.  
- **Drafts:** Server-side **draft** + **resume token**; **TTL** from **global/product** admin settings.  
- **Pricing:** Store **reference price** (from **admin import / UI**), **margin policy**, **computed client price**; **recalculate** pre-checkout; **lock** post–payment-intent.  
- **Imports:** Parser + schema mapping, **row-level validation**, **dry-run** where feasible, **audit** of applied batches, idempotency strategy for re-imports (e.g. natural keys per row).

## Open questions

- **Exact** Paddle objects (one-time vs subscription if any upsells), **webhook** signing strategy, **sandbox** matrix.  
- **Legal:** partner contracts and **data retention** for **documents**.  
- **“Government approval”** states — wording must match **truth** per product.  
- **Discount** thresholds (percent vs currency) — set initial **warnings** from finance.  
- **Import templates:** versioned **column specs** + **changelog** when spreadsheets change.

## Related routes (existing app)

See [`PRODUCT_REQUIREMENTS.md`](../../PRODUCT_REQUIREMENTS.md): `/portal/client-dashboard`, `/portal/application-workspace`, admin surfaces — extend rather than duplicate where possible.

---

## Implementation status & next phases (engineering)

**Phase 0 (plumbing)** — in progress / largely landed: Drizzle schema for catalog, applications, payments; migration **`0002_harsh_wolverine`** with RLS scaffold + RBAC seed; **`lib/db/actor-context.ts`**; example API routes; JSON envelope + middleware request/path headers; OTel + Pino wiring. (Legacy **job/automation** tables may exist from earlier plans — **new work** should align with **file-based** reference pricing; see [`docs/IMPLEMENTATION_REFERENCE.md`](../IMPLEMENTATION_REFERENCE.md).)

| Phase | Focus | Notes |
|-------|--------|--------|
| **1** | Catalog + pricing | Admin CRUD, eligibility, margin policies, quote engine; align RLS with **`pricing.*`** permissions. |
| **2** | Drafts + guests + documents | Resume token model + **guest access** (RLS or server-only pattern); document upload + extraction tables; cleanup job. |
| **3** | Paddle | Provider adapter, checkout lock, webhooks → **`withSystemDbActor`**, idempotent `payment_event`; refund flow + **`payments.refund`** in RLS or system-only writes. |
| **4** | Imports + ops fulfillment | **CSV/XLSX** import for catalog + reference pricing; validation + audit; optional notify on change; **manual** fulfillment and **manual success**; **no** price scraping. |

**First admin + RBAC:** After creating the first `admin_user`, assign the seeded **`super_admin`** role (`id` `00000000-0000-0000-0000-000000000001`) via **`admin_user_role`** so `withAdminDbActor` resolves permissions.
