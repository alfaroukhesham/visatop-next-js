# Visa platform — design (brainstorm consolidation)

**Status:** Draft from facilitated brainstorm  
**Date:** 2026-04-07  
**Aligns with:** [`PRODUCT_REQUIREMENTS.md`](../../PRODUCT_REQUIREMENTS.md), [`DESIGN.md`](../../DESIGN.md)

**Implementation conventions:** [`docs/IMPLEMENTATION_REFERENCE.md`](../IMPLEMENTATION_REFERENCE.md)

## Executive summary

Build a **nationality-first** visa funnel (guest or signed-in): **select nationality → choose visa service → upload documents → OCR/AI extraction → Paddle checkout → reference + email**. **Admins** control **products**, **eligible nationalities**, **pricing**, **enable/disable**, and **operational actions** (refunds/credits/reject/accept with audit). **Unofficial** integration with **one or more affiliate websites** via **scraping + headless automation** (no official API) — **Firecrawl (or equivalent)** for **reference price** discovery and **Playwright** for **form fill** toward “ready for ops payment,” with **manual completion** as a **first-class** path. **Internal** economics (affiliate cost vs client payment vs margin) stay **off** client-visible surfaces; client sees **simple status** and **neutral** copy when automation hands off to humans.

## Non-goals / risks (explicit)

- **No guarantee** of stable automation without **official** integration: **layout changes**, **CAPTCHAs**, **anti-bot**, **sessions**, and **ToS** exposure are expected. **Mitigation:** per-product **kill switch**, **observability**, **manual fallback**, **no auto-refund** on automation failure (ops decides).
- **Scraping/automation** requires **legal review** per jurisdiction and target site terms.

## Key product decisions (locked in brainstorm)

| Topic | Decision |
|--------|-----------|
| Affiliate integration model | **B** — No official API; **scrape + automate public UI** with accepted risk |
| Money flow | **A** — Client pays **MoR (Paddle)** the **all-in** price; **company/ops** pays affiliate from **operational funds**; margin internal |
| Refunds / reversals | **D** — **Flexible admin intents** (refund / credit / reject-without-refund) with **audit**; details governed by policy + MoR rules |
| Automation failure after client paid | **B** — **No auto-refund**; ops **decides**; client sees **clear status**; ops may **manually** complete and mark **manual success** |
| Proof on manual success | **D** — **Tiered** by product/value; **internal** confirmation of affiliate payment vs client payment; **client** sees **high-level** states (e.g. specialist handling → awaiting authority), **not** margin breakdown |
| Transactional email content | **D** — **Principles + per-template** copy; **MoR** remains receipt owner; product emails emphasize **next steps + tracking** |
| Payments architecture | **C** — **Provider abstraction**; **Paddle** first concrete adapter |
| Guest browser storage | **D** — **Threat model** first; **default stance:** **server-authoritative** drafts + **resume token** in **localStorage**; **avoid** storing **passport/OCR** in localStorage |
| Guest draft TTL | **D** — **Admin-configurable** global + per-product override |
| Price sync cadence | **B** default **daily** + **D** — **manual on-demand** sync + **background job** with **progress** + **notify on change** |
| Re-pricing vs drafts | **D (hybrid)** — **Before Paddle checkout / firm intent:** prices can **move up** when reference cost rises (**no** long-lived “old low” promise). **After payment intent:** **freeze** charged amount. **Admin** can apply **discounts/overrides** with **audit** + **soft thresholds** |
| Discount authority | **D** — Start with **audit + reason** + **warnings** above thresholds; evolve to roles/dual control later |
| MVP scope | **D** — **Phased roadmap**; **ambition:** **E2E** including **Firecrawl + Playwright** against **real affiliate** in MVP **if** ops accepts operational load |
| Automation rollout | **B** — **All configured products** use automation by default (with **per-product enable/disable**), not a pilot whitelist only |
| Affiliate domains (count) | **D** — Likely **one** first; architecture should allow **connectors** for more |
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
- **Sync:** **Daily** reference sync + **manual** sync; **monitor job**; **notify on change**.  
- **Automation:** **Playwright** attempts **fill-to-ready**; failures queue to **manual** path.  
- **Manual success:** Tiered **proof**; **internal** amounts; client status **does not** reveal affiliate vs margin.  
- **Money ops:** **Refund/credit/reject** flows with **audit**; integrate **Paddle** refunds where applicable.

## Architecture notes (high level)

- **Payments:** `PaymentProvider` interface: checkout session, webhooks → **normalized domain events**, refunds, idempotency. **Paddle** adapter first.  
- **Drafts:** Server-side **draft** + **resume token**; **TTL** from **global/product** admin settings.  
- **Pricing:** Store **reference price** (from sync), **margin policy**, **computed client price**; **recalculate** pre-checkout; **lock** post–payment-intent.  
- **Affiliate automation:** **Connector** per domain: **selector maps**, **versioning**, **secrets**, **kill switch**, **job traces** (redacted).  
- **Scrape vs drive:** **Firecrawl** (or similar) for **read/monitor**; **Playwright** for **write/automation**; shared **health** metrics.

## Open questions

- **Exact** Paddle objects (one-time vs subscription if any upsells), **webhook** signing strategy, **sandbox** matrix.  
- **Legal:** scraping/automation **per target site**; data retention for **documents**.  
- **“Government approval”** states — wording must match **truth** per product.  
- **Discount** thresholds (percent vs currency) — set initial **warnings** from finance.  
- **Affiliate connector** mapping maintenance when UI changes — **playbook** (selector updates, rollback).

## Related routes (existing app)

See [`PRODUCT_REQUIREMENTS.md`](../../PRODUCT_REQUIREMENTS.md): `/portal/client-dashboard`, `/portal/application-workspace`, admin surfaces — extend rather than duplicate where possible.

---

## Implementation status & next phases (engineering)

**Phase 0 (plumbing)** — in progress / largely landed: Drizzle schema for catalog, applications, payments, affiliate jobs; migration **`0002_harsh_wolverine`** with RLS scaffold + RBAC seed; **`lib/db/actor-context.ts`**; example API routes; JSON envelope + middleware request/path headers; OTel + Pino wiring. See [`docs/IMPLEMENTATION_REFERENCE.md`](../IMPLEMENTATION_REFERENCE.md) for RLS gaps and trust boundaries.

| Phase | Focus | Notes |
|-------|--------|--------|
| **1** | Catalog + pricing | Admin CRUD, eligibility, margin policies, quote engine; align RLS with **`pricing.*`** permissions. |
| **2** | Drafts + guests + documents | Resume token model + **guest access** (RLS or server-only pattern); document upload + extraction tables; cleanup job. |
| **3** | Paddle | Provider adapter, checkout lock, webhooks → **`withSystemDbActor`**, idempotent `payment_event`; refund flow + **`payments.refund`** in RLS or system-only writes. |
| **4** | Affiliate automation | Firecrawl/sync jobs, Playwright workers, kill switch, manual fallback; all job DB writes under **`system`** or explicit policies. |

**First admin + RBAC:** After creating the first `admin_user`, assign the seeded **`super_admin`** role (`id` `00000000-0000-0000-0000-000000000001`) via **`admin_user_role`** so `withAdminDbActor` resolves permissions.
