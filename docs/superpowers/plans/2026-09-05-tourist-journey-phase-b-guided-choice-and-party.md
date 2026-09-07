# Phase B — Guided visa choice & multi-traveller checkout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Prerequisite:** Phase A complete (including Document rules + 2026-09-06 Catalog list-then-edit). Cursor-reviewed.  
> **Executor:** OpenCode. **Reviewer:** Cursor.  
> **Index:** [2026-09-05-tourist-journey-README.md](./2026-09-05-tourist-journey-README.md)  
> **Rule:** `.cursor/rules/visa-admin-and-customer-together.mdc` — every task below has an admin owner or explicitly reuses a shipped admin surface.

**Goal:** Francesco configures how each visa appears in guided choice, whether **multi-traveller applications** are allowed, and the traveller cap — all in Catalog / Settings. Customers answer stay → entry → adult/child, pick from a shortlist of **priced eligible** products, optionally add travellers, and pay **one** checkout for the whole group.

**Architecture:** Guided filter is a pure function over **admin fields on `visa_service`**, never service-name regex or ISO region lists. Apply still only sees enabled + priced pairs (`listPublicServicesForNationality`). A multi-traveller application is `application_party` + one `application` per traveller; checkout and `payment` stay on the primary; webhook fans out. Documents stay Phase A resolver + Document rules per member. A solo applicant still uses the same APIs (one traveller).

**Copy rule:** Admin and customer UI never say “party.” Use **multi-traveller application**, **travellers**, **Add traveller**, **primary traveller**. `party_*` / `application_party` stay as **code** names only.

**Tech Stack:** Existing Catalog service form/PATCH, Settings/`platform_setting`, `createDraftBodySchema`, checkout + webhook. Next migrations: **`0024_visa_service_guided_choice`** then **`0025_application_party`**. Do not touch `0023_catalog_document_type`.

**Do not:**

- Rebuild Catalog as an inline-edit dump, or move Document rules onto Catalog.
- Classify transit / 5-year / child from `name`.
- Hardcode `MAX_PARTY_TRAVELERS = 8` as the only source of truth (Settings is).
- Invent prices. Missing price → pair stays hidden on apply (already shipped).
- Use `window.confirm` — use `ConfirmDialog`.

---

## File map

| Area | Create | Modify |
|---|---|---|
| Service chooser fields | `drizzle/0024_visa_service_guided_choice.sql` | `lib/db/schema/visa.ts`, `catalog-types.ts`, `catalog-service-form.tsx`, `get-catalog-entity.ts`, `visa-services` POST/PATCH, `catalog-service-list.tsx` |
| Multi-traveller on/off + cap + badge copy | `lib/apply/apply-config.ts`, `components/admin/party-settings.tsx`, `components/admin/apply-price-badge-settings.tsx` | `app/admin/(protected)/settings/page.tsx`, settings API if needed |
| Public config + catalog | `app/api/catalog/apply-config/route.ts` | `lib/catalog/queries.ts`, `app/api/catalog/services/route.ts` (+ tests) |
| Guided filter | `lib/apply/guided-visa-filter.ts` + test | — |
| Chooser UI | `components/apply/guided-visa-chooser.tsx`, `components/apply/all-in-price-badges.tsx` | `start-application-form.tsx` |
| Party draft helpers | `lib/apply/party-travelers.ts` + test | start form / chooser |
| Party schema | `lib/db/schema/application-party.ts`, `drizzle/0025_application_party.sql` | `applications.ts`, `schema/index.ts`, journal |
| Create draft | `lib/applications/create-party-draft.ts` + test | `create-draft-body.ts`, `app/api/applications/route.ts` |
| Public party | `lib/applications/public-party.ts`, `lib/applications/load-party-members.ts` | GET application, draft panel |
| Checkout | `lib/payments/party-checkout-total.ts` + test | `app/api/checkout/route.ts`, webhook + test, `checkout-order-recap.tsx` |
| Admin multi-traveller | — | applications list/detail: group travellers, member links |

---

### Task 1: Admin service fields for guided choice

**Files:**
- Create: `drizzle/0024_visa_service_guided_choice.sql`
- Modify: `lib/db/schema/visa.ts`, `drizzle/meta/_journal.json` (idx 24)
- Modify: `lib/admin/catalog/catalog-types.ts`, `get-catalog-entity.ts`
- Modify: `app/api/admin/catalog/visa-services/route.ts` (POST body)
- Modify: `app/api/admin/catalog/visa-services/[id]/route.ts` (PATCH)
- Modify: `components/admin/catalog-service-form.tsx`, `catalog-service-list.tsx`
- Test: `app/api/admin/catalog/visa-services/[id]/route.test.ts` (extend)

```typescript
export const STAY_BUCKETS = ["1_14", "15_30", "31_60", "transit", "5_year"] as const;
export type TStayBucket = (typeof STAY_BUCKETS)[number];

export const ENTRY_KINDS = ["single", "multiple", "either"] as const;
export type TEntryKind = (typeof ENTRY_KINDS)[number];

export const TRAVELER_KINDS = ["adult", "child"] as const;
export type TTravelerKind = (typeof TRAVELER_KINDS)[number];
```

On `visa_service` add (all nullable except defaults below):

| Column | Type | Default | Apply behavior if unset |
|---|---|---|---|
| `stay_bucket` | text | null | Hidden from guided chooser |
| `entry_kind` | text | `'either'` | Matches both Single and Multiple answers |
| `traveler_kind` | text | `'adult'` | Only in Adult shortlist |
| `show_in_guided_chooser` | boolean | true | Hidden from chooser when false |

SQL check: `stay_bucket` null or in the five keys; `entry_kind` in three keys; `traveler_kind` in two.

**One-time backfill (duration/entries already admin-entered — not a runtime classifier):**

```sql
UPDATE visa_service SET stay_bucket = CASE
  WHEN duration_days IS NULL THEN NULL
  WHEN duration_days <= 14 THEN '1_14'
  WHEN duration_days <= 30 THEN '15_30'
  WHEN duration_days <= 60 THEN '31_60'
  WHEN duration_days >= 1825 THEN '5_year'
  ELSE NULL
END
WHERE stay_bucket IS NULL;

UPDATE visa_service SET entry_kind = CASE
  WHEN lower(coalesce(entries, '')) LIKE '%multi%' THEN 'multiple'
  WHEN lower(coalesce(entries, '')) LIKE '%single%' THEN 'single'
  ELSE 'either'
END
WHERE entry_kind IS NULL OR entry_kind = 'either';
```

After migrate, Francesco **must** open Catalog → each transit / 5-year / child SKU and set `stay_bucket` / `traveler_kind` correctly. The service list shows a **Needs guided fields** badge when `stay_bucket` is null or `show_in_guided_chooser` is true but stay is null.

**Service form** (same list-then-edit page, not a new route): four controls under duration/entries:

- Stay bucket: select — empty / 1–14 / 15–30 / 31–60 / Transit / 5 years
- Entry: Single / Multiple / Either
- Traveler: Adult / Child
- Show in guided chooser: checkbox

PATCH/POST zod:

```typescript
stayBucket: z.enum(STAY_BUCKETS).nullable().optional(),
entryKind: z.enum(ENTRY_KINDS).optional(),
travelerKind: z.enum(TRAVELER_KINDS).optional(),
showInGuidedChooser: z.boolean().optional(),
```

Audit `catalog.visa_service.update` afterJson includes the new fields.

- [ ] **Step 1:** Failing PATCH test: body `{ stayBucket: "transit", travelerKind: "adult" }` persists and returns those fields.
- [ ] **Step 2:** Migration + schema + form + list badge. `pnpm exec vitest run app/api/admin/catalog/visa-services`
- [ ] **Step 3:** Browser: edit a service, save, reload — fields stick. Hub list shows the badge.

---

### Task 2: Settings — multi-traveller on/off, max, and price badge copy

**Files:**
- Create: `lib/apply/apply-config.ts` + `lib/apply/apply-config.test.ts`
- Create: `components/admin/party-settings.tsx`
- Create: `components/admin/apply-price-badge-settings.tsx`
- Modify: `app/admin/(protected)/settings/page.tsx`
- Reuse: existing settings GET/PATCH pattern from `draft-ttl-settings.tsx` / `app/api/admin/settings/draft-ttl/route.ts` (`settings.read` / `settings.write`, audit)

```typescript
export const PLATFORM_KEY_PARTY_ENABLED = "party_enabled";
export const DEFAULT_PARTY_ENABLED = true;

export const PLATFORM_KEY_PARTY_MAX_TRAVELERS = "party_max_travelers";
export const DEFAULT_PARTY_MAX_TRAVELERS = 8;

export const PLATFORM_KEY_APPLY_PRICE_BADGES = "apply_price_badges";
export type TApplyPriceBadges = {
  allFeesIncluded: string;
  noHiddenCharges: string;
};
export const DEFAULT_APPLY_PRICE_BADGES: TApplyPriceBadges = {
  allFeesIncluded: "All fees included",
  noHiddenCharges: "No hidden charges",
};

export const parsePartyEnabled = (value: string | null | undefined): boolean => {
  if (value === undefined || value === null || value === "") return DEFAULT_PARTY_ENABLED;
  return value === "true" || value === "1";
};

export const parsePartyMaxTravelers = (value: string | null | undefined): number => {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || n < 1 || n > 20) return DEFAULT_PARTY_MAX_TRAVELERS;
  return n;
};
```

Settings page: **Multi-traveller applications** section (toggle + max) and **Price badges** section, under Draft expiry (same card chrome). Missing keys → defaults; first save upserts `platform_setting`.

Settings copy (exact):

- Section title: **Multi-traveller applications**
- Toggle label: **Allow more than one traveller on a checkout**
- Help: **When off, customers can only apply for one traveller. Existing multi-traveller applications stay in Applications.**
- Number field: **Maximum travellers per checkout**

When the toggle is **off**:

- Apply hides **Add traveller**. Create is still one traveller (same APIs).
- `POST /api/applications` rejects `travelers.length > 1` with 400 (do not trust the client).
- Admin Applications still shows existing multi-traveller groups; this switch does not delete them.

When **on**: cap is `party_max_travelers` (default 8).

- [ ] **Step 1:** Tests for parse + JSON badge parse (invalid JSON → defaults). `parsePartyEnabled("false") === false`.
- [ ] **Step 2:** Admin UI + persist. Do not use `useEffect` to copy props into state (React Doctor).

---

### Task 3: Public apply-config + catalog rows include chooser fields

**Files:**
- Create: `app/api/catalog/apply-config/route.ts` (`export const runtime = "nodejs"`)
- Modify: `lib/catalog/queries.ts` `PublicServiceRow`
- Modify: `app/api/catalog/services/route.test.ts`

`GET /api/catalog/apply-config` via `withSystemDbActor`:

```typescript
jsonOk({
  partyEnabled: boolean,
  partyMaxTravelers: number,
  badges: TApplyPriceBadges,
});
```

No admin-only keys (no FX, no draft TTL hours unless already public).

`PublicServiceRow` add:

```typescript
stayBucket: TStayBucket | null;
entryKind: TEntryKind;
travelerKind: TTravelerKind;
showInGuidedChooser: boolean;
```

- [ ] **Step 1:** Extend services route test: fixture service with `stayBucket: "15_30"` appears on the payload.
- [ ] **Step 2:** Implement select columns. Unset stay → `null` on the public row.

---

### Task 4: Guided filter (pure, catalog fields only)

**Files:**
- Create: `lib/apply/guided-visa-filter.ts` + `lib/apply/guided-visa-filter.test.ts`

```typescript
export type TGuidedService = {
  id: string;
  stayBucket: TStayBucket | null;
  entryKind: TEntryKind;
  travelerKind: TTravelerKind;
  showInGuidedChooser: boolean;
};

export const filterGuidedServices = (
  services: TGuidedService[],
  answers: { stay: TStayBucket; entry: "single" | "multiple"; kind: TTravelerKind },
): TGuidedService[] =>
  services.filter((s) => {
    if (!s.showInGuidedChooser || s.stayBucket === null) return false;
    if (s.stayBucket !== answers.stay) return false;
    if (s.travelerKind !== answers.kind) return false;
    if (answers.stay === "transit") return true;
    if (s.entryKind === "either") return true;
    return s.entryKind === answers.entry;
  });

export const visibleStayBuckets = (services: TGuidedService[]): TStayBucket[] => {
  const have = new Set(
    services.filter((s) => s.showInGuidedChooser && s.stayBucket).map((s) => s.stayBucket!),
  );
  return STAY_BUCKETS.filter((b) => have.has(b));
};
```

- [ ] **Step 1: Tests**

```typescript
const catalog = [
  { id: "b", stayBucket: "15_30", entryKind: "single", travelerKind: "adult", showInGuidedChooser: true },
  { id: "c", stayBucket: "15_30", entryKind: "multiple", travelerKind: "adult", showInGuidedChooser: true },
  { id: "d", stayBucket: "15_30", entryKind: "single", travelerKind: "child", showInGuidedChooser: true },
  { id: "e", stayBucket: "transit", entryKind: "either", travelerKind: "adult", showInGuidedChooser: true },
  { id: "hidden", stayBucket: "15_30", entryKind: "single", travelerKind: "adult", showInGuidedChooser: false },
  { id: "incomplete", stayBucket: null, entryKind: "either", travelerKind: "adult", showInGuidedChooser: true },
];

it("returns 30-day single adult only", () => {
  expect(
    filterGuidedServices(catalog, { stay: "15_30", entry: "single", kind: "adult" }).map((s) => s.id),
  ).toEqual(["b"]);
});

it("hides incomplete and opted-out rows", () => {
  expect(
    filterGuidedServices(catalog, { stay: "15_30", entry: "single", kind: "adult" }).map((s) => s.id),
  ).not.toContain("hidden");
  expect(
    filterGuidedServices(catalog, { stay: "15_30", entry: "single", kind: "adult" }).map((s) => s.id),
  ).not.toContain("incomplete");
});
```

- [ ] **Step 2:** FAIL → implement → `pnpm exec vitest run lib/apply/guided-visa-filter.test.ts` PASS

There is **no** `stayBucketOf(durationDays)` and **no** `isChildService(name)` in apply code.

---

### Task 5: Replace the card wall with the question flow

**Files:**
- Create: `components/apply/guided-visa-chooser.tsx`
- Create: `components/apply/all-in-price-badges.tsx`
- Modify: `components/apply/start-application-form.tsx`

After nationality is known:

1. Stay buttons = `visibleStayBuckets` only (labels from apply-config later; v1 English: `1–14 days` / `15–30 days` / `31–60 days` / `Transit` / `5 years` — these five labels may live in `APPLY_STAY_LABELS` keyed by `TStayBucket`, not by inventing extra buckets).
2. Entry: Single / Multiple — skip when stay is `transit` or every remaining row is `entryKind === "either"` or only one entry kind exists.
3. Primary traveler: Adult / Child — hide Child if no child SKU in the current stay filter.
4. Matching priced rows only. CTA **Continue with this visa**.
5. Email required on this step.
6. Currency toggle: **USD** / **AED** only.

`AllInPriceBadges` reads strings from apply-config (Task 2), not hardcoded JSX.

Empty shortlist: “No visa matches these answers. Change your answers or contact us.” — do not invent a product.

- [ ] **Step 1:** Implement chooser with `filterGuidedServices`.
- [ ] **Step 2:** `pnpm exec vitest run lib/apply/guided-visa-filter.test.ts`

---

### Task 6: Additional travelers (UI + validation)

**Files:**
- Create: `lib/apply/party-travelers.ts` + test
- Modify: start form / chooser

```typescript
export type TPartyTravelerDraft = {
  key: string;
  kind: TTravelerKind;
  serviceId: string;
};

export const canAddTraveler = (count: number, max: number): boolean => count < max;
```

`max` comes from apply-config (`partyMaxTravelers`), not a file-level `8`. `partyEnabled` comes from the same config.

- Default: one primary traveller (kind + selected `serviceId`).
- **Add traveller** is hidden when `partyEnabled` is false. When on: Adult or Child. Additional picks from the **same stay/entry** and that kind’s shortlist.
- Disable add at `max`.
- Running **checkout total** = sum of `displayPriceMinor` + badges from config.

```typescript
export const assertTravelersReady = (
  travelers: TPartyTravelerDraft[],
  max: number,
): { ok: true } | { ok: false; message: string } => {
  if (travelers.length < 1) return { ok: false, message: "Add at least one traveller." };
  if (travelers.length > max) {
    return { ok: false, message: `Maximum ${max} travellers per checkout.` };
  }
  if (travelers.some((t) => !t.serviceId)) {
    return { ok: false, message: "Choose a visa for every traveller." };
  }
  return { ok: true };
};
```

Submit: `travelers: [{ serviceId, kind }]`.

- [ ] **Step 1:** Tests: cannot add past `max`; empty `serviceId` invalid; `max` of 2 rejects 3.

---

### Task 7: Multi-traveller schema + migration `0025`

**Files:**
- Create: `lib/db/schema/application-party.ts`
- Create: `drizzle/0025_application_party.sql`
- Modify: `lib/db/schema/applications.ts`, `lib/db/schema/index.ts`, `drizzle/meta/_journal.json` (idx 25)

```typescript
export const TRAVELER_ROLE = { PRIMARY: "primary", ADDITIONAL: "additional" } as const;

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

On `application`: nullable `partyId` → `application_party.id` ON DELETE CASCADE; `travelerRole` default `primary`; `travelerKind` default `adult`; `travelerIndex` default `0`.

Copy `resumeTokenHash` onto **every** member (same hash). Also store it on `application_party` (Phase C hint).

RLS on `application_party` in **this** migration (do not wait for Task 11):

```sql
ALTER TABLE "application_party" ENABLE ROW LEVEL SECURITY;

CREATE POLICY application_party_system_all ON "application_party"
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');

CREATE POLICY application_party_admin_select ON "application_party"
  FOR SELECT
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.read'));

CREATE POLICY application_party_admin_update ON "application_party"
  FOR UPDATE
  USING (app_actor_type() = 'admin' AND app_has_permission('applications.write'))
  WITH CHECK (app_actor_type() = 'admin' AND app_has_permission('applications.write'));
```

Create/checkout/webhook stay on `withSystemDbActor`. Task 11 reads the group with `withAdminDbActor` and `applications.read` — **not** `catalog.read`. No client policies.

Existing rows: `party_id` null OK. New creates always insert an `application_party` row (including a single traveller).

- [ ] **Step 1:** Schema + SQL + journal idx 25.
- [ ] **Step 2:** Typecheck imports.

---

### Task 8: Create draft accepts `travelers[]`

**Files:**
- Modify: `lib/applications/create-draft-body.ts`
- Create: `lib/applications/create-party-draft.ts` + test
- Modify: `app/api/applications/route.ts` + existing route test

```typescript
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
  travelers: z.array(travelerSchema).min(1).optional(),
  guestEmail: z.email().max(320).optional(),
  catalogCurrency: z.enum(["USD", "AED"]).default("USD"),
}).refine((b) => Boolean(b.travelers?.length || b.serviceId), {
  message: "Choose a service.",
});
```

Server must re-read `party_enabled` and `party_max_travelers`. If multi-traveller is off and `travelers.length > 1` → 400. If on and `travelers.length > max` → 400. Do not trust the client. Each `serviceId` must be enabled, priced for that nationality, and `travelerKind` must match the catalog field (or 400).

`createPartyDraft` in one transaction: insert `application_party` (email, nationality, currency, resume hash, TTL from `getDraftTtlHoursFromTx`, `paymentStatus: unpaid`); insert N applications; return `{ partyId, primaryApplicationId, memberIds }`.

Route: set `vt_resume` once. JSON `{ application: { id: primary, isGuest }, partyId, memberIds }`. Redirect target stays `/apply/applications/:primaryId`.

- [ ] **Step 1:** Tests: `{ serviceId }` still works (normalize to one adult); 9 travelers rejected when max is 8; two travelers rejected when `party_enabled` is false; child `serviceId` with adult kind → 400.

---

### Task 9: Load travellers on the documents page

**Files:**
- Create: `lib/applications/load-party-members.ts` + test
- Modify: `GET /api/applications/[id]` (or add `GET /api/applications/[id]/party`)
- Modify: draft hook + `application-draft-panel.tsx`
- Create: `components/apply/draft/party-documents-tabs.tsx`

`loadPartyMembers`: if `partyId` set, all members by `travelerIndex`; else `[that application]` (legacy).

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

UI: one `DraftDocumentsSection` + `ApplicantReview` per member. Slots from Phase A resolver + Document rules for **that member’s** `serviceId` + shared nationality. Upload/extract already take `applicationId`.

Pay CTA once (primary). Cookie hash matches any member.

- [ ] **Step 1:** Legacy null `partyId` returns one member. Two travellers return both ordered.

---

### Task 10: Multi-traveller checkout total + webhook fan-out

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

Checkout: resolve members; `resolveCheckoutTotal` per member; any missing price → 400 `pricing_unavailable`; one `price_quote` on primary; one `payment` on primary; freeze `checkoutState` on all members.

Metadata: `applicationId` (primary), `partyId`, `priceQuoteId`, `userId?`, `isGuest`, `serviceId` (primary). Never affiliate breakdown.

Webhook `payment_completed`: all members `paid` / `in_progress`; `retainRequiredDocuments` per member (Document rules extras included); `application_party.paymentStatus = paid`; skip already paid.

Recap: N>1 lists “Traveller 1 — {serviceName}” + **one** total + badges from apply-config.

- [ ] **Step 1:** Webhook test: two members both paid; retain called twice.

---

### Task 11: Admin — list travellers and set each outcome on this page

**Files:**
- Create: `lib/admin/load-application-travellers.ts` + test (wraps `loadPartyMembers` + per-member statuses)
- Create: `components/admin/admin-application-travellers.tsx`
- Modify: `app/admin/(protected)/applications/[id]/page.tsx` — load **all** members when `partyId` is set
- Modify: `components/admin/admin-application-detail-view.tsx`
- Modify: `components/admin/admin-applications-list-client.tsx` (and list query)
- Reuse: `AdminApplicationOpsPanel` / `useAdminApplicationOps` (already keyed by `applicationId`)

Admin already has Applications. Extend this page. Do not invent a second inbox. Do not add/remove travellers after create.

**List**

- If `partyId` is set and member count > 1: badge **Multi-traveller · {n} travellers** plus adult/child for that row.
- Solo (one member): normal row, no multi-traveller badge.

**Detail — Travellers on this application**

Load every sibling `application` (and that row’s documents) in the same `withAdminDbActor` transaction. If `partyId` is null, the card is omitted (legacy solo).

Card copy:

- Title: **Travellers on this application**
- Each row: **Primary traveller** or **Traveller {n}**, adult/child, product name, application / payment / fulfillment badges.
- Selecting a row (tabs or a list) shows **that traveller’s** existing **Fulfillment & outcomes** (`AdminApplicationOpsPanel` with **that** `applicationId` and **that** traveller’s documents).
- Ops can mark traveller A completed (approval pack) and traveller B rejected on **this same page** without opening a second URL. Status writes stay per `application` (already the model). One checkout still lives on the primary; do not invent a group-level approve-all.
- Optional deep link: `/admin/applications/[id]?traveller={memberId}` selects that row after load.

`useAdminApplicationOps` already takes `applicationId`. Remount the panel when the selected traveller changes (`key={selectedApplicationId}`) so file/status state does not leak across travellers.

**RLS**

Policies are in Task 7’s `0025`. Task 11 only **uses** them: `withAdminDbActor` + `applications.read`. If the travellers card is empty for a write-capable admin, the Task 7 policies were skipped — fix the migration, do not query `db` without actor context.

- [ ] **Step 1:** Loader test: two members → both statuses returned; legacy null `partyId` → no extra rows.
- [ ] **Step 2:** UI: select traveller 2, apply rejection + outcome doc; traveller 1 stays `in_progress`. Refresh: both statuses persist. No “party” in the UI.

---

### Task 12: Phase B verification

```bash
pnpm exec vitest run lib/apply/guided-visa-filter.test.ts lib/apply/party-travelers.test.ts lib/apply/apply-config.test.ts lib/applications/create-party-draft.test.ts lib/payments/party-checkout-total.test.ts lib/payments/apply-payment-webhook-event.test.ts app/api/applications/route.test.ts app/api/catalog/services/route.test.ts
pnpm run lint
```

Migrate **0024 then 0025** on the Neon branch used by local/dev (`pnpm run db:migrate`).

**Phase B done when:**

- [ ] Catalog service edit persists stay / entry / traveler / show-in-chooser.
- [ ] A service with null `stayBucket` never appears in the chooser.
- [ ] Child shortlist only contains `travelerKind = child` SKUs (no `/child/i` on the name).
- [ ] Settings: multi-traveller off hides Add traveller and the API rejects `travelers.length > 1`. On + max 2 disables a third traveller and the API rejects 3.
- [ ] Badge strings change when Settings values change (no deploy).
- [ ] Two travellers create 2 apps; checkout sum; webhook pays both.
- [ ] Admin application detail lists both travellers; ops can approve one and reject the other on that same page; copy never says “party”.
- [ ] Document slots still come from Document rules + passport/photo floor (India tourist extra vs France tourist vs transit — whatever Francesco assigned).

---

## Suggested commit (only if orchestrator asks)

```
feat(apply): admin-driven guided chooser and multi-traveler party checkout
```
