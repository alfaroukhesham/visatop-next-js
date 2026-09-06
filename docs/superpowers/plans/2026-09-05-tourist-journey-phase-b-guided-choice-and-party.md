# Phase B — Guided visa choice & party (multi-applicant) checkout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Prerequisite:** Phase A complete and Cursor-reviewed.  
> **Executor:** OpenCode. **Reviewer:** Cursor.  
> **Index:** [2026-09-05-tourist-journey-README.md](./2026-09-05-tourist-journey-README.md)

**Goal:** Replace the 10-card wall with a DubaiVisa-style question flow, collect email on this step, and create a **party of 1–8 travelers** with **one checkout** (sum of catalog prices, one customer total).

**Architecture:** Client-side filter of `GET /api/catalog/services` (do not invent prices). Child vs adult is a **catalog SKU**, not a free-age form. Persist `application_party` + one `application` per traveler. Checkout and `payment` stay on the **primary** application; quote total = sum of members; webhook fans out `paid` + retain to every member. Solo = party of one (same API).

**Tech Stack:** Existing start form, `createDraftBodySchema`, Drizzle migration `0023_application_party` (0022 is reserved for admin `catalog_document_requirement` on the Phase A train), checkout + webhook paths already in `app/api/checkout/route.ts` and `lib/payments/apply-payment-webhook-event.ts`.

---

## File map

| Area | Create | Modify |
|---|---|---|
| Guided filter | `lib/apply/guided-visa-filter.ts` | `components/apply/start-application-form.tsx` |
| All-in badges | `components/apply/all-in-price-badges.tsx` | `checkout-order-recap.tsx`, start form |
| Party schema | `lib/db/schema/application-party.ts`, `drizzle/0023_application_party.sql` | `lib/db/schema/applications.ts`, `lib/db/schema/index.ts` |
| Create draft | `lib/applications/create-party-draft.ts` | `lib/applications/create-draft-body.ts`, `app/api/applications/route.ts` |
| Public party | `lib/applications/public-party.ts` | `toPublicApplication` consumers, draft panel |
| Checkout | `lib/payments/party-checkout-total.ts` | `app/api/checkout/route.ts`, webhook |
| Docs UI | `components/apply/draft/party-documents-tabs.tsx` | draft panel |

**Locked limits:** `MAX_PARTY_TRAVELERS = 8`. Shared `nationalityCode` from step 1. `travelerKind`: `adult` \| `child`. First traveler is `primary`.

**Payment metadata** (must include): `applicationId` (primary), `partyId`, `priceQuoteId`, `userId?`, `isGuest`. Never put affiliate/cost breakdown in metadata the client can see.

---

### Task 1: Guided filter (pure)

**Files:**
- Create: `lib/apply/guided-visa-filter.ts`
- Test: `lib/apply/guided-visa-filter.test.ts`

```typescript
import { classifyServiceKind, isChildService } from "./service-kind";

export type TStayBucket = "1_14" | "15_30" | "31_60" | "transit" | "5_year";
export type TEntryFilter = "single" | "multiple";
export type TTravelerKind = "adult" | "child";

export type TGuidedService = {
  id: string;
  name: string;
  durationDays: number | null;
  entries: string | null;
};

export const stayBucketOf = (s: TGuidedService): TStayBucket | null => {
  if (classifyServiceKind({ name: s.name, durationDays: s.durationDays }) === "transit") {
    return "transit";
  }
  if (/\b5\s*year/.test(s.name.toLowerCase()) || (s.durationDays !== null && s.durationDays >= 365 * 5)) {
    return "5_year";
  }
  const d = s.durationDays;
  if (d === null) return null;
  if (d <= 14) return "1_14";
  if (d <= 30) return "15_30";
  if (d <= 60) return "31_60";
  return null;
};

export const matchesEntry = (entries: string | null, want: TEntryFilter): boolean => {
  if (!entries) return true;
  const e = entries.toLowerCase();
  if (want === "multiple") return e.includes("multi");
  return e.includes("single") && !e.includes("multi");
};

export const filterGuidedServices = (
  services: TGuidedService[],
  answers: { stay: TStayBucket; entry: TEntryFilter; kind: TTravelerKind },
): TGuidedService[] => {
  return services.filter((s) => {
    if (stayBucketOf(s) !== answers.stay) return false;
    if (answers.stay !== "transit" && !matchesEntry(s.entries, answers.entry)) return false;
    const child = isChildService(s.name);
    if (answers.kind === "child") return child;
    return !child;
  });
};
```

- [ ] **Step 1: Tests**

```typescript
import { describe, expect, it } from "vitest";
import { filterGuidedServices, stayBucketOf } from "./guided-visa-filter";

const catalog = [
  { id: "a", name: "14 Days Tourist", durationDays: 14, entries: "single" },
  { id: "b", name: "30 Days Tourist", durationDays: 30, entries: "single" },
  { id: "c", name: "30 Days Tourist Multiple", durationDays: 30, entries: "multi" },
  { id: "d", name: "30 Days Tourist Child", durationDays: 30, entries: "single" },
  { id: "e", name: "48 Hours Transit Visa", durationDays: 2, entries: "single" },
  { id: "f", name: "5 Years Multiple Entry", durationDays: 1825, entries: "multi" },
];

describe("filterGuidedServices", () => {
  it("returns 30-day single adult only", () => {
    const ids = filterGuidedServices(catalog, {
      stay: "15_30",
      entry: "single",
      kind: "adult",
    }).map((s) => s.id);
    expect(ids).toEqual(["b"]);
  });

  it("returns child SKU when traveler is child", () => {
    const ids = filterGuidedServices(catalog, {
      stay: "15_30",
      entry: "single",
      kind: "child",
    }).map((s) => s.id);
    expect(ids).toEqual(["d"]);
  });

  it("isolates transit from tourist cards", () => {
    const ids = filterGuidedServices(catalog, {
      stay: "transit",
      entry: "single",
      kind: "adult",
    }).map((s) => s.id);
    expect(ids).toEqual(["e"]);
  });
});

describe("stayBucketOf", () => {
  it("maps 5-year products", () => {
    expect(stayBucketOf(catalog[5]!)).toBe("5_year");
  });
});
```

- [ ] **Step 2–4:** FAIL → implement → `pnpm exec vitest run lib/apply/guided-visa-filter.test.ts` PASS

---

### Task 2: Replace the card wall with the question flow

**Files:**
- Modify: `components/apply/start-application-form.tsx`
- Create: `components/apply/guided-visa-chooser.tsx`

After nationality is known (already on this page):

1. **Stay:** buttons `1–14 days` / `15–30 days` / `31–60 days` / `Transit` / `5 years` (hide a bucket if `filter` of catalog for that stay is empty).
2. **Entry:** Single / Multiple — **skip** when stay is `transit` (or only one entry exists).
3. **Primary traveler:** Adult / Child (child uses child SKUs).
4. Show **matching** rows only (1–3 typical). Selected card + primary CTA **Continue with this visa** (not “Next” on a 10-grid).
5. **Email** field stays on this step (required).
6. Currency toggle: labels **USD** and **AED** only (remove “United States (US) dollar” / long dirham name).

Do not add a travel-date question.

Extract a presentational `GuidedVisaChooser` so the form stays readable. Types: `IGuidedVisaChooserProps` + `FC`.

- [ ] **Step 1:** Implement chooser using `filterGuidedServices`.
- [ ] **Step 2:** `pnpm exec vitest run lib/apply/guided-visa-filter.test.ts`

---

### Task 3: Additional travelers (UI state only)

**Files:**
- Create: `lib/apply/party-travelers.ts` + test
- Modify: start form / chooser

```typescript
import type { TTravelerKind } from "./guided-visa-filter";

export const MAX_PARTY_TRAVELERS = 8;

export type TPartyTravelerDraft = {
  key: string;
  kind: TTravelerKind;
  serviceId: string;
};

export const canAddTraveler = (count: number): boolean => count < MAX_PARTY_TRAVELERS;

export const nextTravelerKindDefault = (kind: TTravelerKind): TTravelerKind => kind;
```

UI under the shortlist:

- Default: one primary traveler (kind + selected `serviceId`).
- **Add traveler** → Adult or Child. Each additional picks from the **same stay/entry filter** but kind-specific shortlist (must select a service before submit).
- Disable add at 8.
- Show running **party total** (sum of `displayPriceMinor` for selected services) + Task 4 badges.

Submit body (next task): `travelers: [{ serviceId, kind }]`.

Tests: cannot add 9th; empty additional without `serviceId` is invalid.

```typescript
export const assertTravelersReady = (
  travelers: TPartyTravelerDraft[],
): { ok: true } | { ok: false; message: string } => {
  if (travelers.length < 1) return { ok: false, message: "Add at least one traveler." };
  if (travelers.length > MAX_PARTY_TRAVELERS) {
    return { ok: false, message: "Maximum 8 travelers per checkout." };
  }
  if (travelers.some((t) => !t.serviceId)) {
    return { ok: false, message: "Choose a visa for every traveler." };
  }
  return { ok: true };
};
```

---

### Task 4: All-in badges (choice → pay)

**Files:**
- Create: `components/apply/all-in-price-badges.tsx`
- Modify: start form, `components/apply/checkout-order-recap.tsx`

```tsx
import type { FC } from "react";

export interface IAllInPriceBadgesProps {
  className?: string;
}

export const AllInPriceBadges: FC<IAllInPriceBadgesProps> = ({ className }) => (
  <p className={className}>
    <span className="font-semibold">All fees included</span>
    <span aria-hidden> · </span>
    <span className="font-semibold">No hidden charges</span>
  </p>
);
```

Show compact total + badges from visa choice through `CheckoutOrderRecap`. Recap may list **traveler product names** (Phase B Task 8). Never list government vs service fee lines.

---

### Task 5: Party schema + migration

**Files:**
- Create: `lib/db/schema/application-party.ts`
- Modify: `lib/db/schema/applications.ts`, `lib/db/schema/index.ts`
- Create: `drizzle/0023_application_party.sql`
- Update: `drizzle/meta/_journal.json` (next idx after 0022 catalog document requirement, tag `0023_application_party`)

```typescript
import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { nationality } from "./visa";

export const TRAVELER_ROLE = { PRIMARY: "primary", ADDITIONAL: "additional" } as const;
export const TRAVELER_KIND = { ADULT: "adult", CHILD: "child" } as const;

export const applicationParty = pgTable(
  "application_party",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    isGuest: boolean("is_guest").default(true).notNull(),
    guestEmail: text("guest_email"),
    nationalityCode: text("nationality_code")
      .notNull()
      .references(() => nationality.code),
    catalogCurrency: text("catalog_currency").default("USD").notNull(),
    resumeTokenHash: text("resume_token_hash"),
    draftExpiresAt: timestamp("draft_expires_at"),
    paymentStatus: text("payment_status").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("application_party_resumeTokenHash_idx").on(t.resumeTokenHash),
    index("application_party_guestEmail_idx").on(t.guestEmail),
  ],
);
```

On `application` add nullable:

- `partyId` → `application_party.id` on delete cascade
- `travelerRole` text default `'primary'`
- `travelerKind` text default `'adult'`
- `travelerIndex` integer default `0`

Copy `resumeTokenHash` onto **every** member (same hash) so existing `vt_resume` + `loadGuestApplicationRowByResumeCookie(applicationId)` keeps working for any member URL. Also store the hash on the party for resume-hint (Phase C).

SQL:

```sql
CREATE TABLE "application_party" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text,
  "is_guest" boolean DEFAULT true NOT NULL,
  "guest_email" text,
  "nationality_code" text NOT NULL,
  "catalog_currency" text DEFAULT 'USD' NOT NULL,
  "resume_token_hash" text,
  "draft_expires_at" timestamp,
  "payment_status" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
-- FKs + indexes matching schema
ALTER TABLE "application" ADD COLUMN "party_id" text;
ALTER TABLE "application" ADD COLUMN "traveler_role" text DEFAULT 'primary' NOT NULL;
ALTER TABLE "application" ADD COLUMN "traveler_kind" text DEFAULT 'adult' NOT NULL;
ALTER TABLE "application" ADD COLUMN "traveler_index" integer DEFAULT 0 NOT NULL;
-- FK application.party_id → application_party.id ON DELETE CASCADE
```

Backfill is not required for new drafts. Existing rows: `party_id` null is OK until first new create; create path always inserts a party (including solo).

RLS: party table is not client-selected directly. Guest routes keep using `withSystemDbActor` after cookie verify. Add a restrictive RLS policy (deny client/admin default; system only) consistent with other sensitive tables — follow `docs/IMPLEMENTATION_REFERENCE.md` RLS patterns. If you add admin select later, use `withAdminDbActor`.

- [ ] **Step 1:** Schema + SQL + journal.
- [ ] **Step 2:** `pnpm exec tsc --noEmit` or project’s usual typecheck if `tsc` is not wired — at minimum `pnpm exec vitest run` still compiles imports.

---

### Task 6: Create draft accepts `travelers[]`

**Files:**
- Modify: `lib/applications/create-draft-body.ts`
- Create: `lib/applications/create-party-draft.ts` + test
- Modify: `app/api/applications/route.ts`

```typescript
import { z } from "zod";

const travelerSchema = z.object({
  serviceId: z.string().min(1),
  kind: z.enum(["adult", "child"]).default("adult"),
});

export const createDraftBodySchema = z.object({
  nationalityCode: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "Nationality code must be two letters")
    .transform((s) => s.toUpperCase()),
  serviceId: z.string().min(1).optional(),
  travelers: z.array(travelerSchema).min(1).max(8).optional(),
  guestEmail: z.email().max(320).optional(),
  catalogCurrency: z.enum(["USD", "AED"]).default("USD"),
}).refine((b) => Boolean(b.travelers?.length || b.serviceId), {
  message: "Choose a service.",
});
```

Normalize:

```typescript
export const normalizeCreateTravelers = (body: CreateDraftBody): Array<{ serviceId: string; kind: "adult" | "child" }> => {
  if (body.travelers?.length) return body.travelers;
  return [{ serviceId: body.serviceId!, kind: "adult" }];
};
```

`createPartyDraft(tx, …)` in one transaction:

1. Insert `application_party` (email, nationality, currency, resume hash, TTL, `paymentStatus: unpaid`).
2. Insert N `application` rows (same hash, `partyId`, role/kind/index, same statuses as today).
3. Return `{ partyId, primaryApplicationId, memberIds }`.

Route: set `vt_resume` once. JSON:

```json
{ "application": { "id": "<primary>", "isGuest": true }, "partyId": "<id>", "memberIds": ["..."] }
```

`toPublicApplication` of primary stays the redirect target: `/apply/applications/:primaryId`.

Tests: `create-draft-body` refine; `normalizeCreateTravelers`; mock tx insert count 1 party + N apps (`lib/applications/create-party-draft.test.ts`). Extend `app/api/applications/route.test.ts` if it posts `{ serviceId }` — that path must still work.

Start form POST uses `travelers` from Task 3.

---

### Task 7: Load party on the documents page

**Files:**
- Create: `lib/applications/load-party-members.ts` + test
- Modify: `GET /api/applications/[id]` (or add `GET /api/applications/[id]/party`)
- Modify: draft hook + panel

`loadPartyMembers(tx, applicationId)`:

- If `partyId` set, return all members ordered by `travelerIndex`.
- If null, return `[that application]` (legacy).

Public payload (no PII docs bytes):

```typescript
export type TPublicPartyMember = {
  applicationId: string;
  travelerRole: "primary" | "additional";
  travelerKind: "adult" | "child";
  travelerIndex: number;
  serviceId: string;
  serviceName: string;
};
```

UI: tabs or stacked sections — **one `DraftDocumentsSection` + `ApplicantReview` per member** (Phase A resolver per member `serviceId` + shared nationality). Upload/extract APIs already take `applicationId` — call them with the **member** id.

Pay CTA lives once (primary), using party-aware payment copy (any member missing slots → incomplete copy).

Access: cookie hash matches **any** member; signed-in owner of party/`userId`.

---

### Task 8: Party checkout total + webhook fan-out

**Files:**
- Create: `lib/payments/party-checkout-total.ts` + test
- Modify: `app/api/checkout/route.ts`
- Modify: `lib/payments/apply-payment-webhook-event.ts` + test
- Modify: `components/apply/checkout-order-recap.tsx`

```typescript
export type TPartyLine = {
  applicationId: string;
  serviceId: string;
  amountMinor: bigint;
  currency: string;
};

export const sumPartyLines = (lines: TPartyLine[]): bigint =>
  lines.reduce((acc, l) => acc + l.amountMinor, 0n);
```

Checkout (same transaction as today):

1. Resolve members via `loadPartyMembers`.
2. For **each** member `resolveCheckoutTotal(tx, { nationalityCode, serviceId, catalogCurrency })`. If any missing → 400 `pricing_unavailable`.
3. `total = sumPartyLines`. Lock **one** `price_quote` on the **primary** id. `breakdownJson` may list per-traveler `applicationId` + `serviceId` + `amountMinor` for **ops** — do not send that breakdown to the client recap as a fee split. Client recap: product names + **one** total + badges.
4. One `payment` row on primary. Freeze `checkoutState` on **all** members.
5. Metadata:

```typescript
metadata: {
  applicationId: primaryId,
  partyId: party.id,
  priceQuoteId: quoteId,
  isGuest: String(lockedApp.isGuest),
  serviceId: lockedApp.serviceId,
  catalogCurrency,
}
```

Webhook `payment_completed` after primary transitions to paid:

- Update **all** party members: `paymentStatus: paid`, `applicationStatus: in_progress`, `fulfillmentStatus: automation_running`, `checkoutState: none`.
- `retainRequiredDocuments` **per member**.
- Set `application_party.paymentStatus = paid`.
- Idempotent: skip members already `paid`.

Failed checkout: clear `checkoutState` on all members.

`apply-payment-webhook-event.test.ts`: add a case with two members (primary + additional) — both become paid; retain called twice (mock).

Recap: if party has N>1, list “Traveler 1 — {serviceName}” etc. and a single total. Still **All fees included**.

---

### Task 9: Phase B verification

```bash
pnpm exec vitest run lib/apply/guided-visa-filter.test.ts lib/apply/party-travelers.test.ts lib/applications/create-draft-body.ts lib/applications/create-party-draft.test.ts lib/payments/party-checkout-total.test.ts lib/payments/apply-payment-webhook-event.test.ts app/api/applications/route.test.ts
pnpm run lint
```

Apply migration on the Neon branch used by local/dev before QA (`pnpm run db:migrate`).

**Phase B done when:** guided shortlist works; email on step 2; party of 2 creates 2 apps; checkout amount is the sum; webhook pays both; customer sees one total.

---

## Suggested commit (only if orchestrator asks)

```
feat(apply): guided visa chooser and multi-traveler party checkout
```
