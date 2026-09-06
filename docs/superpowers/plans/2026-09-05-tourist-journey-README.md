# Tourist journey — sequential plans (A → B → C)

> **Do not commit this folder until the user approves the docs.**  
> Source brief: `/Users/evolvex/Desktop/visatop-comprehensive-plan-2026-09-04.md`  
> **Orchestrator / reviewer:** Cursor. Executors must not self-certify.  
> **Implementer:** OpenCode (`opencode run --auto --dir <worktree>`).  
> **Handover / session:** Hermes named session + optional ACP sidebar (`hermes acp`).

**Goal:** Ship the tourist apply refresh (trust, guided choice, shell), a **party (multi-applicant) one-checkout**, and a **scoped resume** path — without WordPress homepage, Ads, or a full Better Auth magic-link rebuild.

## Execution order (hard)

1. [Phase A — Trust & documents](./2026-09-05-tourist-journey-phase-a-trust-and-docs.md)  
2. [Phase B — Guided choice & party checkout](./2026-09-05-tourist-journey-phase-b-guided-choice-and-party.md)  
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
| Email | Collected on visa-choice (step 2). One email per **party**. |
| Currency | Labels **USD** / **AED** only. Badges: “All fees included” / “No hidden charges”. No gov/service fee lines. |
| Guided choice | Filter a **shortlist** (1–3). Do not auto-pick one product. No travel-date step unless a catalog rule requires it (v1: skip). |
| Video | No in-flow autoplay. Demote or remove `HomeDemoVideo` from the apply home hero. |
| Status step | Not counted as pre-pay. Rail is Nationality → Visa → Documents → Payment. Status after pay only. |
| Coach overlay | Remove `ApplyJourneyStepBar` “STEP n/5” from tourist apply (home, start, docs, pay). |
| Bank statement | Required **slot** for Africa+Asia **non-transit** (incl. child and 5-year). Transit: never. Pay still allowed if empty. One file (PDF/JPEG/PNG), 8MB. |
| Region list | Explicit ISO allowlist in code (not runtime continent guess). **TR = Asia (in).** **RU, CY = out** until Francesco says otherwise. |
| Party | One `application_party`, **one application row per traveler**, **one checkout** on the **primary** application. Max **8** travelers. Shared nationality from step 1. Adult vs child = catalog SKU, not a free-age form. |
| Resume | Same-browser `vt_resume` **banner**. Track shows **product + country names**. Guest **Continue** when cookie matches. Signed **email resume link** (HMAC, draft TTL) that re-sets the cookie. No fingerprint. No Better Auth magic-link. Token never in localStorage or JSON. |
| Translations | EN first. Message catalog structure in C; extra locales only if files are added, not “all Polylang” in v1. |
| Out of scope | WP homepage, Google Ads, FAQ AI, fee itemization, hard payment gates, independent-files (B′) instead of one-checkout. |

## Architecture (party)

Today: one `application` = one person + one `serviceId` + one `price_quote` + one `payment.applicationId`.

**Keep that.** Add a party wrapper:

- `application_party` holds shared guest email, resume hash, currency, nationality, `draftExpiresAt`, party `paymentStatus`.
- Each traveler is a full `application` (`partyId`, `travelerRole` = `primary` \| `additional`, `travelerKind` = `adult` \| `child`).
- Documents + OCR stay **per application** (Phase A resolver is reused per traveler).
- Checkout metadata: `applicationId` = primary, plus `partyId`, `priceQuoteId`. Quote **total** = sum of each member’s catalog display price. Webhook marks **all** party members paid and retains each member’s uploaded temps.
- Customer UI: one total. Optional line per **traveler product name** (not fee breakdown).

Solo traveler = party of one (same APIs). Do not keep a second create path forever; `POST /api/applications` accepts `travelers: [{ serviceId, kind }]` with a one-item default.

## Suggested Hermes handback query

```text
Do not edit files. Report whether Task N matches .hermes-taskN.md.
List files changed, gaps, and extras. Status: DONE | GAPS | EXTRAS.
```
