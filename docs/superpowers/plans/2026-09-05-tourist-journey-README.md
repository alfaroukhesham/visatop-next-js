# Tourist journey — sequential plans (A → B → C)

> **Do not commit this folder until the user approves the docs.**  
> Source brief: `/Users/evolvex/Desktop/visatop-comprehensive-plan-2026-09-04.md`  
> **Orchestrator / reviewer:** Cursor. Executors must not self-certify.  
> **Implementer:** OpenCode (`opencode run --auto --dir <worktree>`).  
> **Handover / session:** Hermes named session + optional ACP sidebar (`hermes acp`).

**Goal:** Ship the tourist apply refresh (trust, guided choice, shell), **multi-traveller one-checkout**, and a **scoped resume** path — without WordPress homepage, Ads, or a full Better Auth magic-link rebuild.

## Execution order (hard)

1. [Phase A — Trust & documents](./2026-09-05-tourist-journey-phase-a-trust-and-docs.md)  
2. [Phase B — Guided choice & multi-traveller checkout](./2026-09-05-tourist-journey-phase-b-guided-choice-and-party.md)  
3. [Phase C — Shell, resume, SEO](./2026-09-05-tourist-journey-phase-c-shell-resume-seo.md)

Do **not** start Phase B until every Phase A task checkbox is done and Cursor spec+quality review is green. Same for B → C.

After C: hand the **Manual QA checklist** (end of Phase C) to a separate Grok session against **local** `pnpm dev`. Staging only after that pass.

## OpenCode + Hermes protocol

Cursor orchestrates. OpenCode writes code. Hermes holds a named session for handback. ACP is for **you** to watch/approve in the editor — Cursor cannot drive ACP as an RPC bus.

1. Isolated **git worktree**. Do not write on the same files as the Cursor chat or an ACP sidebar at the same time.
2. Cursor extracts **one task** into `<worktree>/.hermes-taskN.md` (full files, tests, locks). Do not say “read the Sep 4 brief.”
3. **OpenCode** implements that file: `opencode run --auto --dir <worktree>`. No commit unless the prompt says to (user rule: ask first).
4. **Hermes** named session on the same worktree — **read/report only**, not a second writer:

```bash
hermes chat --oneshot --quiet --in <worktree> \
  --continue visatop-<plan>-taskN --create-if-missing \
  --query-file <worktree>/.hermes-taskN-handback.md
```

5. Optional: attach the same session in an ACP panel (`hermes` + args `["acp"]`, or Rina Hermes ACP). Do not let the sidebar edit while OpenCode is running.
6. Cursor exports or reads the Hermes report, then **spec review**, then **quality review**. Fail → re-run OpenCode with notes → re-review.
7. Conventions: types `T*`, interfaces `I*`, arrow functions, `FC` + `IProps`, `export const runtime = "nodejs"` on every `app/api/**/route.ts`, `jsonOk`/`jsonError`, RLS via `with*DbActor`, no PII in localStorage, one customer total (no affiliate/fee itemization).

## Suggested OpenCode invoke

```bash
opencode run --auto --dir <worktree> --format json \
  "$(cat <<'EOF'
You are the executor only. Follow .hermes-taskN.md exactly.
TDD when the task has tests. Do not start the next task.
Do not commit unless the prompt says to commit.
EOF
)"
```

## Locked product decisions (all three plans)

| Topic | Decision |
|---|---|
| Pay-first | `APPLY_STEP3_VALIDATION_DISABLED = true` stays. Missing docs/fields **warn**, never block Pay. |
| Email | Collected on visa-choice (step 2). One email per **multi-traveller application**. |
| Currency | Labels **USD** / **AED** only. Badge *text* is admin Settings (not JSX constants). No gov/service fee lines. |
| Guided choice | Filter a shortlist from **admin service fields** (`stayBucket`, `entryKind`, `travelerKind`, `showInGuidedChooser`). Do not auto-pick. No travel-date step in v1. No name-regex / ISO-region classifiers. |
| Documents | Passport + photo stay a **code floor**. Extra slots come from **Document rules** (`catalog_document_type` + `catalog_document_requirement`). Apply never invents a bank/Africa/Asia list. |
| Nationalities | Apply lists enabled + priced catalog nationalities only. Adding a country is Catalog → Nationalities, not a deploy. |
| Video | No in-flow autoplay. Remove `HomeDemoVideo` from the apply home hero. |
| Status step | Not counted as pre-pay. Rail is Nationality → Visa → Documents → Payment. Status after pay only. |
| Coach overlay | Remove `ApplyJourneyStepBar` “STEP n/5” from tourist apply (home, start, docs, pay). |
| Multi-traveller | One `application_party` (code name only), **one application row per traveller**, **one checkout** on the **primary**. Shared nationality from step 1. Adult vs child = `visa_service.travelerKind`. Settings copy: **Multi-traveller applications** / **Allow more than one traveller on a checkout**. Keys: `party_enabled`, `party_max_travelers` (default 8). Off still creates a single-traveller application. UI never says “party.” |
| Resume | Same-browser `vt_resume` banner. Track shows product + country names. Guest Continue when cookie matches. Signed email resume link (HMAC, remaining draft TTL). No fingerprint. No Better Auth magic-link. Token never in localStorage or JSON. Draft TTL already admin (`draft_ttl_hours`). |
| SEO / blog / dial | Apply-home title, H1, timing line, blog row, and phone dial codes are **admin-editable** (Settings + nationality `dialCode`). Not TS constants Francesco cannot change. |
| Out of scope | WP homepage, Google Ads, FAQ AI, fee itemization, hard payment gates, independent-files (B′) instead of one-checkout. |

## Shipped admin (Phase A + 2026-09-06 catalog UX) — do not regress

B and C **extend** these surfaces. Do not rebuild Catalog as a dump page or put Document rules back on Catalog.

| Surface | What exists today |
|---|---|
| Nav | Catalog, Document rules, Pricing, Settings, Applications |
| Catalog hub | `/admin/catalog?tab=services\|nationalities` — read-only lists, Add / Edit / Open / Delete + `ConfirmDialog` |
| Service | `/admin/catalog/services/new` → prices → `/admin/catalog/services/[id]/edit` (name, `durationDays`, `entries`, enabled) + eligible nationalities + service-first prices |
| Nationality | `/admin/catalog/nationalities/new`, `/admin/catalog/nationalities/[code]` (name, enabled) + eligible services. Code is immutable after create |
| Eligibility | Bidirectional pickers. Unpriced pair: “No price — hidden on apply.” Document rules “Add eligibility” → nationality page (not `?prefillNat=`) |
| Delete | Service/nationality `409` if any `application` references the row; eligibility/prices/extra doc rules cascade when delete is allowed |
| Document rules | `/admin/document-rules` list → document view → country → services. Wizard only on create/bulk assign. Delete document + all rules (Dialog) |
| Settings | `draft_ttl_hours`, `fx_aed_per_usd`, payments — `platform_setting` + `settings.read` / `settings.write` |
| Public apply | `GET /api/catalog/services?nationality=&currency=` — enabled + **priced** services only (`PublicServiceRow`: id, name, durationDays, entries, price, documentTypes) |
| Next SQL | Journal idx **24** is free. **0023 is `catalog_document_type` — do not reuse for `application_party`.** |

## Architecture (multi-traveller)

Today: one `application` = one person + one `serviceId` + one `price_quote` + one `payment.applicationId`.

**Keep that.** Add a group wrapper (`application_party` in the database only):

- That table holds shared guest email, resume hash, currency, nationality, `draftExpiresAt`, group `paymentStatus`.
- Each traveller is a full `application` (`partyId`, `travelerRole` = `primary` \| `additional`, `travelerKind` = `adult` \| `child`).
- Documents + OCR stay **per application** (Phase A resolver is reused per traveller).
- Checkout metadata: `applicationId` = primary, plus `partyId`, `priceQuoteId`. Quote **total** = sum of each member’s catalog display price. Webhook marks **all** members paid and retains each member’s uploaded temps.
- Customer UI: one total. Optional line per **traveller product name** (not fee breakdown). Never say “party.”

A single traveller uses the same APIs. Do not keep a second create path forever; `POST /api/applications` accepts `travelers: [{ serviceId, kind }]` with a one-item default.

## Suggested Hermes handback query

```text
Do not edit files. Report whether Task N matches .hermes-taskN.md.
List files changed, gaps, and extras. Status: DONE | GAPS | EXTRAS.
```
