# Admin document requirements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Spec:** [2026-09-05-admin-document-requirements-design.md](../specs/2026-09-05-admin-document-requirements-design.md)  
> **Status:** Implementing (2026-09-06). OpenCode + Hermes protocol in [tourist-journey README](./2026-09-05-tourist-journey-README.md).  
> **Do not commit docs or code until the user asks.** Suggested commit messages are for later.

**Goal:** On `feat/tourist-journey-phase-a` (PR #8), replace hardcoded bank-slot policy with admin **bulk Document rules**: locked passport + photo in code, extras (`bank_statement_6m`) stored per nationality × service as required or additional.

**Architecture:** Extract `#8` slot presentation into `document-slot-catalog.ts`. Persist **extras only** in `catalog_document_requirement`. Public catalog returns extras; the resolver always prepends the floor. Admin Catalog gets a Document rules section: **each country + that country’s eligible services**, select-all-eligible, and a link to the existing Eligibility form. Assign uses **explicit pairs** (not all-countries × all-services). Creating missing Eligibility is allowed only after a **warning confirm**. Seed copies `#8` bank extras only. Leave upload MIME and retain-for-bank intact.

**Base branch:** `feat/tourist-journey-phase-a` at `5010853` (or that branch after merge).

**Tech Stack:** Drizzle + Neon, `withAdminDbActor` / `withSystemDbActor`, `jsonOk`/`jsonError`, `export const runtime = "nodejs"`, Vitest, existing Catalog workspace, `catalog.read` / `catalog.write` / `audit.write`. New components: `FC` + `I*Props`, types `T*`, arrow functions only.

## Review locks

| Topic | Rule |
|---|---|
| Surface | Catalog → **Document rules** section. No Eligibility-row document column. |
| Floor | Passport + photo always required in code. Never stored. Never editable. |
| Extras | Table + assignable list = `#8` types minus floor. v1: `bank_statement_6m`. |
| Role | `required` \| `additional`. Customer Additional block already exists — use it. |
| Picker | Each country + **only its eligible services**. No global all-services list. |
| Select all | Per country: “Select all eligible”. |
| Add eligibility | Link to `#catalog-eligibility` with that nationality prefilled — not a second service dump. |
| Assign | Explicit `{ nationalityCode, serviceId }[]`. Upsert extra. Create missing Eligibility **only after warning confirm**. |
| Warning | If `willCreateEligibility > 0` (stale UI only — picker is eligible-services-only, do **not** add an all-services path): “This will also create **Eligibility** admin links for N pairs. It does **not** set prices — products only appear on apply when a catalog price exists.” Never claim buyability. |
| Unpriced | Eligible + no `catalog_customer_price` → hidden on apply (already true on `#8`). Admin warning “No price — hidden on apply” on Eligibility rows + Document rules picker. Do not block doc assign. |
| Import | **Do not modify** `apply-customer-price-import.ts` / `syncEligibilityForTouchedPairs` / import routes. |
| Remove | Deletes extras only. Never unlinks Eligibility. |
| Pair cap | `pairs.length > 2000` → `400 DOCUMENT_REQUIREMENTS_PAIR_LIMIT`. |
| Seed | Bank extras only. `#8` ISO list + `classifyServiceKind` **literally**. |
| Migration | `0022_catalog_document_requirement.sql`. Phase B party = `0023`. |
| Live drafts | Next catalog load / remount / refresh. No file delete. |
| Retain / upload | Do not modify unless a test breaks. |
| Price import | Do **not** insert extras. Do **not** edit the import pipeline. New eligibility = floor only. |

---

## File map

| Area | Create | Modify |
|---|---|---|
| Schema + RLS | `lib/db/schema/catalog-document-requirement.ts`, `drizzle/0022_catalog_document_requirement.sql` | `lib/db/schema/index.ts` |
| Slot catalog | `lib/apply/document-slot-catalog.ts` + test | **Extract** from `document-requirements.ts` |
| Resolve | — | `document-requirements.ts` + test (floor + extras) |
| Public catalog | — | `lib/catalog/queries.ts`, `app/api/catalog/services/route.test.ts` |
| Draft hook | — | `use-application-draft.ts` only (leave Additional split in `draft-documents-section.tsx`) |
| Domain | `document-requirement-assign.ts` + test, `list-eligibility-by-nationality.ts` | — |
| Admin API | `app/api/admin/catalog/document-requirements/route.ts` + preview + test | — |
| Admin UI | `catalog-document-rules-section.tsx` (+ assign form, review table) | `catalog-workspace.tsx`, `catalog-eligibility-table.tsx`, `list-catalog-eligibility.ts`, `catalog-types.ts` (hasPrice warning only — no import edits) |
| Remove policy | — | Stop apply-path imports of `nationality-regions` / `service-kind` |
| Retain / upload | — | **Do not modify** |

---

### Task 1: Schema + RLS

**Files:**
- Create: `lib/db/schema/catalog-document-requirement.ts`
- Create: `drizzle/0022_catalog_document_requirement.sql`
- Modify: `lib/db/schema/index.ts`

- [ ] **Step 1: Add the Drizzle table**

```typescript
import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { nationality, visaService } from "./visa";

export const CATALOG_DOCUMENT_ROLE = {
  REQUIRED: "required",
  ADDITIONAL: "additional",
} as const;

export const catalogDocumentRequirement = pgTable(
  "catalog_document_requirement",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    nationalityCode: text("nationality_code")
      .notNull()
      .references(() => nationality.code, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => visaService.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("catalog_document_requirement_uidx").on(
      t.nationalityCode,
      t.serviceId,
      t.documentType,
    ),
    index("catalog_document_requirement_nat_idx").on(t.nationalityCode),
    index("catalog_document_requirement_svc_idx").on(t.serviceId),
  ],
);
```

- [ ] **Step 2: Write `drizzle/0022_catalog_document_requirement.sql`**

Create table + FKs + unique index + CHECKs + RLS. Copy GUC / `current_setting` style from eligibility in `drizzle/0003_catalog_addon_rls.sql`:

- Admin SELECT if `catalog.read`
- Admin INSERT/UPDATE/DELETE if `catalog.write`
- System SELECT (public apply)

```sql
ALTER TABLE "catalog_document_requirement"
  ADD CONSTRAINT catalog_document_requirement_role_chk
  CHECK (role IN ('required', 'additional'));
ALTER TABLE "catalog_document_requirement"
  ADD CONSTRAINT catalog_document_requirement_type_chk
  CHECK (document_type NOT IN ('passport_copy', 'personal_photo'));
```

Do **not** put seed INSERTs in this file yet (Task 3). Do **not** create `0023_*`.

- [ ] **Step 3:** `export * from "./catalog-document-requirement";` in `lib/db/schema/index.ts`

- [ ] **Step 4:** Hand-write SQL to match 0003. Do not `db:push` against prod.

---

### Task 2: Extract slot catalog

On `#8`, labels / MIME / 8MB already live in `document-requirements.ts`. **Move** them. Do not invent new copy.

**Files:**
- Create: `lib/apply/document-slot-catalog.ts`
- Create: `lib/apply/document-slot-catalog.test.ts`
- Modify: `lib/apply/document-requirements.ts` (import from extract)

- [ ] **Step 1: Failing test**

```typescript
import { describe, expect, it } from "vitest";
import { DOCUMENT_TYPE } from "@/lib/db/schema/application-document";
import {
  slotForDocumentType,
  FLOOR_DOCUMENT_TYPE_KEYS,
  ASSIGNABLE_DOCUMENT_TYPE_KEYS,
} from "./document-slot-catalog";

describe("document-slot-catalog", () => {
  it("returns bank presentation for bank_statement_6m", () => {
    const slot = slotForDocumentType(DOCUMENT_TYPE.BANK_STATEMENT_6M);
    expect(slot?.key).toBe("bank_statement_6m");
    expect(slot?.label.toLowerCase()).toContain("bank");
    expect(slot?.maxBytes).toBe(8 * 1024 * 1024);
  });

  it("floor keys are passport + photo", () => {
    expect(FLOOR_DOCUMENT_TYPE_KEYS).toEqual([
      DOCUMENT_TYPE.PASSPORT_COPY,
      DOCUMENT_TYPE.PERSONAL_PHOTO,
    ]);
  });

  it("assignable extras exclude the floor", () => {
    expect(ASSIGNABLE_DOCUMENT_TYPE_KEYS).toEqual([DOCUMENT_TYPE.BANK_STATEMENT_6M]);
    expect(ASSIGNABLE_DOCUMENT_TYPE_KEYS).not.toContain(DOCUMENT_TYPE.PASSPORT_COPY);
  });
});
```

- [ ] **Step 2:** `pnpm exec vitest run lib/apply/document-slot-catalog.test.ts` — FAIL

- [ ] **Step 3: Extract** — cut-paste `PASSPORT_SLOT`, `PHOTO_SLOT`, `BANK_SLOT`, `DOCUMENT_SLOT_MAX_BYTES`, `TDocumentSlot`, `TDocSlotRole`, `TDocumentSlotKey` from `document-requirements.ts`. Same strings. Export:

```typescript
export const slotForDocumentType = (key: string): TDocumentSlot | null =>
  SLOT_BY_KEY[key] ?? null;

export const FLOOR_DOCUMENT_TYPE_KEYS = [
  DOCUMENT_TYPE.PASSPORT_COPY,
  DOCUMENT_TYPE.PERSONAL_PHOTO,
] as const;

export const ASSIGNABLE_DOCUMENT_TYPE_KEYS = [
  DOCUMENT_TYPE.BANK_STATEMENT_6M,
] as const;
```

- [ ] **Step 4:** Tests PASS. Re-export types from `document-requirements.ts` if other files import them from there.

---

### Task 3: Seed today’s bank extras only

**Files:**
- Modify: `drizzle/0022_catalog_document_requirement.sql` (append seed). **Do not** create `0023_*`.

- [ ] **Step 1:** Open `lib/apply/nationality-regions.ts` and `lib/apply/service-kind.ts`. Paste — do not re-type.

Insert `bank_statement_6m` / `required` for every `visa_service_eligibility` row where `nationality_code` is in this exact `IN` list **and** the service is not transit. **Do not** insert passport or photo.

```
'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD',
'CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE',
'LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG',
'RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG',
'EH','ZM','ZW',
'AF','AM','AZ','BH','BD','BT','BN','KH','CN','GE','HK','IN','ID',
'IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MO','MY','MV',
'MN','MM','NP','KP','OM','PK','PS','PH','QA','SA','SG','KR','LK',
'SY','TW','TJ','TH','TL','TR','TM','AE','UZ','VN','YE'
```

```sql
AND NOT (
  visa_service.name ~* '\ytransit\y'
  OR visa_service.name ~* '\y48[[:space:]]*h'
  OR visa_service.name ~* '\y96[[:space:]]*h'
  OR visa_service.duration_days IN (2, 4)
)
```

`ON CONFLICT DO NOTHING`. Header comment: “Seed copies `#8` bank extras only (`AFRICA_ASIA_NATIONALITY_CODES` + `classifyServiceKind`). Floor passport/photo stay in code.”

---

### Task 4: Resolver + public catalog extras

**Files:**
- Modify: `lib/apply/document-requirements.ts` + `.test.ts`
- Modify: `lib/catalog/queries.ts`
- Modify: `app/api/catalog/services/route.test.ts`

```typescript
export type TRequirementRow = { documentType: string; role: "required" | "additional" };

export const resolveDocumentRequirements = (rows: TRequirementRow[]): TDocumentSlot[] => {
  const extras = rows
    .filter((r) => !FLOOR_DOCUMENT_TYPE_KEYS.includes(r.documentType as never))
    .map((r) => {
      const slot = slotForDocumentType(r.documentType);
      if (!slot) return null;
      return { ...slot, role: r.role };
    })
    .filter((s): s is TDocumentSlot => s !== null);
  const floor = FLOOR_DOCUMENT_TYPE_KEYS.map((k) => slotForDocumentType(k)!);
  return [...floor, ...extras];
};
```

Must **not** import `nationality-regions` or `service-kind`.

- [ ] **Step 1: Rewrite tests**

```typescript
it("always includes passport and photo", () => {
  expect(requiredDocumentTypeKeys(resolveDocumentRequirements([]))).toEqual([
    "passport_copy",
    "personal_photo",
  ]);
});

it("appends a required bank extra", () => {
  const slots = resolveDocumentRequirements([
    { documentType: "bank_statement_6m", role: "required" },
  ]);
  expect(slots.map((s) => s.key)).toEqual([
    "passport_copy",
    "personal_photo",
    "bank_statement_6m",
  ]);
  expect(slots.find((s) => s.key === "bank_statement_6m")?.role).toBe("required");
});

it("appends an additional bank extra without dropping the floor", () => {
  const slots = resolveDocumentRequirements([
    { documentType: "bank_statement_6m", role: "additional" },
  ]);
  expect(slots.filter((s) => s.role === "additional").map((s) => s.key)).toEqual([
    "bank_statement_6m",
  ]);
  expect(requiredDocumentTypeKeys(slots)).toEqual(["passport_copy", "personal_photo"]);
});

it("ignores unknown types and floor keys in extras", () => {
  const slots = resolveDocumentRequirements([
    { documentType: "not_a_real_type", role: "required" },
    { documentType: "passport_copy", role: "additional" },
  ]);
  expect(slots.map((s) => s.key)).toEqual(["passport_copy", "personal_photo"]);
});
```

- [ ] **Step 2:** `pnpm exec vitest run lib/apply/document-requirements.test.ts` — FAIL then implement — PASS

- [ ] **Step 3: Load extras in `listPublicServicesForNationality`**

After `services[]`, query extras for `(nationalityCode, serviceIds)`. Extend `PublicServiceRow`:

```typescript
documentTypes: Array<{ key: string; role: "required" | "additional" }>;
```

`documentTypes` = extras for that service, or `[]`. **Do not** put passport/photo in the payload. **Do not** remove the existing `exists(catalog_customer_price)` filter — unpriced services stay off apply.

- [ ] **Step 4:** Catalog services route test asserts `documentTypes` is an array (mock `[]`).

---

### Task 5: Draft hook uses catalog extras

**Files:**
- Modify: `components/apply/draft/use-application-draft.ts`
- Modify: `components/apply/draft/types.ts` if `CatalogService` lives there

- [ ] **Step 1:** Extend the hook `CatalogService` type with `documentTypes`.

- [ ] **Step 2:** Replace `resolveDocumentRequirements({ nationalityCode, serviceName, durationDays })` with:

```typescript
const slots = useMemo<TDocumentSlot[]>(
  () =>
    resolveDocumentRequirements(
      (service?.documentTypes ?? []).map((d) => ({
        documentType: d.key,
        role: d.role,
      })),
    ),
  [service],
);
```

One-line comment above the `useMemo`: slots follow the last catalog payload; a mid-session admin edit appears after remount or nationality / service / currency change.

- [ ] **Step 3:** Grep apply/UI for `requiresAfricaAsiaBankStatementNationality` and `classifyServiceKind`. They must not build slots. Do **not** change `draft-documents-section.tsx` Additional split.

---

### Task 6: Assign / preview / remove domain

**Files:**
- Create: `lib/admin/catalog/document-requirement-assign.ts`
- Create: `lib/admin/catalog/document-requirement-assign.test.ts`

```typescript
export const DOCUMENT_REQUIREMENT_PAIR_LIMIT = 2000;

export type TDocumentRequirementPair = {
  nationalityCode: string;
  serviceId: string;
};

export type TDocumentRequirementAssignInput = {
  documentType: string;
  role: "required" | "additional";
  pairs: TDocumentRequirementPair[];
};

export type TDocumentRequirementAssignPreview = {
  pairCount: number;
  alreadyEligible: number;
  willCreateEligibility: number;
  pairsWithoutPrice: number;
  alreadyHasDocument: number;
  willInsert: number;
  willUpdateRole: number;
};

export type TDocumentRequirementAssignResult = {
  pairCount: number;
  eligibilityCreated: number;
  upserted: number;
};
```

- [ ] **Step 1: Failing tests** (fake `tx` in the retain-test style)

1. `preview` of 3 **explicit** pairs, 1 already eligible, 0 extras, 1 without a price row → `pairCount=3`, `willCreateEligibility=2`, `pairsWithoutPrice=1`, `willInsert=3`.
2. `assign` inserts missing eligibility + extras; second assign with other role updates role only (`eligibilityCreated=0`).
3. `assign` rejects floor type, unknown type, empty `pairs`, and `pairs.length > 2000`.
4. `remove` deletes extras for those pairs and does **not** delete eligibility.
5. `removeOne` deletes a single row.
6. Dedupes duplicate pairs in the payload.

- [ ] **Step 2:** Implement `previewDocumentRequirementAssign`, `assignDocumentRequirements`, `removeDocumentRequirements`, `removeOneDocumentRequirement` (caller supplies `tx`).

Logic for assign:

1. Dedupe pairs (`NAT:serviceId`); uppercase nationality codes.
2. If `documentType` not in `ASSIGNABLE_DOCUMENT_TYPE_KEYS` → throw `{ code: "DOCUMENT_REQUIREMENTS_TYPE_INVALID" }`.
3. If `pairs.length === 0` or `> 2000` → throw.
4. Confirm every nationality code and service id exists.
5. Preview: count existing eligibility, extras, and `catalog_customer_price` rows for **those pairs** + type. `willCreateEligibility` = pairs with no eligibility row (stale-UI safety net). `pairsWithoutPrice` = pairs with no price row. Do **not** invent a cartesian or an all-services assign path.
6. Assign: `insert visa_service_eligibility … onConflictDoNothing` for pairs that need it; upsert extras. **Do not** expand into a cartesian of unused services.
7. Remove: `delete` extras for those pairs + type. Never touch `visa_service_eligibility`.

- [ ] **Step 3:** Tests PASS.

---

### Task 7: Admin API

**Files:**
- Create: `app/api/admin/catalog/document-requirements/route.ts`
- Create: `app/api/admin/catalog/document-requirements/preview/route.ts`
- Create: `app/api/admin/catalog/document-requirements/route.test.ts`

`export const runtime = "nodejs";` on every route.

Body (assign + preview + bulk remove):

```typescript
const pairSchema = z.object({
  nationalityCode: z.string().length(2).regex(/^[A-Za-z]{2}$/).transform((s) => s.toUpperCase()),
  serviceId: z.string().min(1),
});

const assignBodySchema = z.object({
  documentType: z.enum(["bank_statement_6m"]),
  role: z.enum(["required", "additional"]),
  pairs: z.array(pairSchema).min(1).max(2000),
});
```

**GET** `/api/admin/catalog/document-requirements` — `catalog.read`.  
- Default: paginated extras for the review table (`page`, `pageSize`, optional `nationalityCode`, `serviceId`, `documentType`). Items: `{ id, nationalityCode, serviceId, serviceName, documentType, role }`.  
- `?picker=1`: `{ countries: Array<{ code, name, services: Array<{ id, name, hasPrice: boolean }> }> }` — **every** catalog nationality, `services` = current Eligibility only. `hasPrice` = exists `catalog_customer_price` for that pair. Implement via `listEligibilityByNationality` in `lib/admin/catalog/list-eligibility-by-nationality.ts` (eligibility query + price existence query, group in JS). Do not paginate the picker. Do not include services that are only priced and not eligible.

**POST** `/api/admin/catalog/document-requirements/preview` — `catalog.read`. Returns preview counts. No writes.

**POST** `/api/admin/catalog/document-requirements` — `catalog.read` + `catalog.write` + `audit.write`. Assign. Audit `catalog.document_requirement.bulk_assign` with type, role, codes, ids, `eligibilityCreated`, `upserted`.

**DELETE** `/api/admin/catalog/document-requirements` — same write perms. If body has `id`, `removeOne`. Else bulk remove (body without `role`). Audit `catalog.document_requirement.remove` or `bulk_remove`. Never delete eligibility.

Map domain throw codes to `jsonError` (`400` / `404`).

- [ ] **Step 1:** Route tests — 403 without write; 200 picker groups services per country; 200 preview reports `willCreateEligibility`; 200 assign creates eligibility only for listed pairs (not a cartesian); 400 pair limit; 200 bulk remove leaves eligibility; 404 missing single id. Mock `runAdminDbJson` like `eligibility/route.test.ts`.

---

### Task 8: Document rules UI

**Files:**
- Create: `components/admin/catalog-document-rules-section.tsx`
- Create: `components/admin/catalog-document-rules-assign-form.tsx`
- Create: `components/admin/catalog-document-rules-table.tsx`
- Create: `lib/admin/catalog/document-requirement-mutations.ts`
- Modify: `components/admin/catalog-workspace.tsx` — Document rules **after** Eligibility. Add `id="catalog-eligibility"` on the Eligibility card. Do **not** add a Documents column to `catalog-eligibility-table.tsx`.
- Modify: `components/admin/catalog-eligibility-section.tsx` — accept optional `prefillNationalityCode` + `onPrefillConsumed` so the Add-eligibility link can set the existing link form’s nationality.
- Modify: `lib/admin/catalog/catalog-types.ts` + `list-catalog-eligibility.ts` + `catalog-eligibility-table.tsx` — add `hasPrice: boolean` per row. If false, show text-sm warning: “No price — hidden on apply.” Do not change import code.

Conventions: `FC`, props interfaces `ICatalogDocumentRulesSectionProps` (etc.) **above** each component, arrow functions.

- [ ] **Step 1: Banner + country-first assign form**

`ICatalogDocumentRulesAssignFormProps`: `canWrite`, `busy`, `flash`, `onChanged`, `onAddEligibility: (nationalityCode: string) => void`.

- Banner: “Every application always needs passport + personal photo. Those cannot be turned off.”
- Select document (v1 one option, label from slot catalog).
- Role: Required | Additional.
- Load picker via `GET …/document-requirements?picker=1`.
- Country search. Each country is a block: name, **Select all eligible**, **Add eligibility** (calls `onAddEligibility(code)` — workspace scrolls to `#catalog-eligibility` and prefills nationality). Under the country: checkboxes for **that country’s eligible services only**. Empty: “No eligible services. Add eligibility to offer a product.”
- If `hasPrice === false`, next to the service name: “No price — hidden on apply.” Still checkable.
- Do **not** render a global list of all services. `willCreateEligibility > 0` is a stale-UI safety net only — do not build a second all-services picker.
- Selected state is a `Set` of `${code}:${serviceId}` pairs.
- **Preview and assign…** → POST preview.
  - If `willCreateEligibility > 0`, blocking confirm: “This will also create **Eligibility** admin links for N pairs. It does **not** set prices — products only appear on apply when a catalog price exists.” Cancel = no write.
  - If `pairsWithoutPrice > 0`, also: “M of these pairs have no catalog price and stay hidden on apply until you add a price (Pricing or sheet import).”
  - If both counts are 0, short confirm: “Set this document on N eligible pairs.”
- **Preview and remove…** → “Remove this document from N pairs. Eligibility links stay.”
- `canWrite === false` → read-only, no buttons.

- [ ] **Step 2: Review table**

Paginated GET. Columns: nationality, service name, document label, role, remove (if `canWrite`). Filters: nationality, service, document type.

- [ ] **Step 3: Mutations**

```typescript
export const previewDocumentRequirements = async (input: {
  documentType: string;
  role: "required" | "additional";
  pairs: Array<{ nationalityCode: string; serviceId: string }>;
}) =>
  fetchApiEnvelope(apiHref("/admin/catalog/document-requirements/preview"), {
    method: "POST",
    body: JSON.stringify(input),
  });
```

Same for assign POST and DELETE (pairs, not two global arrays).

- [ ] **Step 4:** Mount in `AdminCatalogWorkspace`. Card title: “Document rules”. Description: “Assign extra documents to a country’s eligible products. Use Add eligibility if a product is missing.” After an Eligibility link from this flow, refetch the picker.

---

### Task 9: Delete hardcoded policy from apply

**Files:**
- Confirm `document-requirements.ts` has no allowlist import
- Delete or stop exporting runtime use of `nationality-regions.ts` **after** seed SQL contains the list
- Delete `service-kind.ts` if grep is clean (`isChildService` is unused on `#8`). Prefer **delete** if nothing else imports them.

- [ ] **Step 1:** `rg "requiresAfricaAsia|AFRICA_ASIA|classifyServiceKind" --glob '!docs/**' --glob '!drizzle/**'`
- [ ] **Step 2:** Remove leftover files/tests that only support the hardcoded resolver.
- [ ] **Step 3:** Confirm `lib/applications/retain-required-documents.ts` still lists `BANK_STATEMENT_6M`. Confirm upload MIME still allows bank. Do not “fix” them if already correct.

---

### Task 10: Verification

```bash
pnpm exec vitest run lib/apply lib/catalog lib/admin/catalog/document-requirement-assign.test.ts app/api/catalog/services/route.test.ts app/api/admin/catalog/document-requirements
pnpm run lint
```

Manual:

1. After seed: India × 30-day tourist draft still has **three** required slots; France tourist **two**; India transit **two**.
2. Document rules shows India with only India’s eligible SKUs — not a dump of every service. France does not list an Indian-only SKU.
3. **Select all eligible** on India ticks only India’s products. **Add eligibility** scrolls to Eligibility with IN prefilled; after linking a new SKU it appears under India.
4. Assign bank as **Additional** to France’s 30-day (already eligible) → short confirm, no Eligibility warning. Draft: passport/photo required, bank in Additional.
5. If preview reports `willCreateEligibility > 0`, the **Eligibility-link warning** (not buyability) must appear and Cancel must not write. Confirm creates Eligibility and the extra.
6. Eligible row with no price: Eligibility table + Document rules picker show “No price — hidden on apply.” That SKU is **absent** from `GET /api/catalog/services` for that nationality. Sheet import still works unchanged.
7. After seed, flip India 30-day bank from required → additional in Document rules → draft shows bank in the Additional block; passport/photo stay required.
8. Bulk remove bank from those France rows → draft is two slots; Eligibility row **remains**.
9. Review-table single remove works. Cannot turn off passport/photo. Pay still works with empty bank.
10. Open draft, assign bank, refresh apply → extra slot appears; uploaded passport still there. Retain still lists bank.

---

## Suggested commit (only if asked)

```
feat(catalog): bulk admin document rules per nationality and service
```

---

## Self-review

- Spec: extras-only table, locked floor, country → eligible services, Add-eligibility link, explicit pairs, **Eligibility ≠ buyable** warning, unpriced admin warning, import untouched, public extras + resolver, seed bank-only — each has a task.
- No global all-countries × all-services cartesian in the UI.
- No Eligibility-row checkboxes. No `ensureDefaultDocumentRequirements` on price import.
- `additional` is a first-class assign role.
- Migration `0022`; Phase B stays `0023`.
- Pair cap 2000. Floor types rejected on write.
- Pay-first unchanged. No CSV. No new document types.
