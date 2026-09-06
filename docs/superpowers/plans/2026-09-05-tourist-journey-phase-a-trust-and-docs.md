# Phase A — Trust & documents

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Executor:** OpenCode. **Reviewer:** Cursor. Do not start Phase B until this file’s tasks are done and reviewed.  
> **Index:** [2026-09-05-tourist-journey-README.md](./2026-09-05-tourist-journey-README.md)

**Follow-up (required):** Hardcoded Africa/Asia + transit rules must move to admin. Spec + plan: [admin-document-requirements-design.md](../specs/2026-09-05-admin-document-requirements-design.md) · [2026-09-05-admin-document-requirements.md](./2026-09-05-admin-document-requirements.md).

**Goal:** Customer-safe uploads/OCR, honest pay-first copy, human-readable nationality/product names, and a nationality × service document-slot resolver including the Africa/Asia 6-month bank-statement rule.

**Architecture:** Pure resolver + ISO allowlist + service-kind classifier. UI renders slots from the resolver (no hard-coded passport+photo grid). Retention accepts the resolved required types. Pay-first stays on. Solo traveler only in this phase (party comes in B).

**Tech Stack:** TypeScript, Vitest (`pnpm exec vitest run <file>`), existing draft components, Drizzle schema constants (text `document_type` — no enum migration required for a new type string).

---

## File map

| Area | Create | Modify |
|---|---|---|
| Doc type | — | `lib/db/schema/application-document.ts` |
| Classifier + allowlist | `lib/apply/service-kind.ts`, `lib/apply/nationality-regions.ts` | — |
| Resolver | `lib/apply/document-requirements.ts` | — |
| Tests | `lib/apply/*.test.ts` | `lib/applications/retain-required-documents.test.ts` |
| Upload UI | — | `components/apply/draft/document-upload-slot.tsx`, `types.ts`, `draft-documents-section.tsx`, `use-application-draft.ts`, `application-draft-panel.tsx` |
| Copy | `lib/apply/payment-copy.ts` | `draft-payment-section.tsx`, `applicant-review.tsx`, `utils.ts` |
| Names | `lib/apply/display-names.ts` | `applicant-review.tsx`, `application-track-lookup-form.tsx`, track-lookup API |
| Retain | — | `lib/applications/retain-required-documents.ts` |

**Reuse:** `PublicServiceRow` in `lib/catalog/queries.ts`; `toPublicApplication`; `APPLY_STEP3_VALIDATION_DISABLED`; `i18n-iso-countries` only if already used on the client — prefer a small server/catalog name map from `GET /api/catalog/nationalities`.

---

### Task 1: `bank_statement_6m` document type + `DocType`

**Files:**
- Modify: `lib/db/schema/application-document.ts`
- Modify: `components/apply/draft/types.ts`
- Test: `lib/apply/document-type-constants.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/apply/document-type-constants.test.ts
import { describe, expect, it } from "vitest";
import { DOCUMENT_TYPE } from "@/lib/db/schema/application-document";

describe("DOCUMENT_TYPE", () => {
  it("includes bank_statement_6m for the Africa/Asia tourist rule", () => {
    expect(DOCUMENT_TYPE.BANK_STATEMENT_6M).toBe("bank_statement_6m");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run lib/apply/document-type-constants.test.ts
```

Expected: FAIL (export missing) or file/module not found.

- [ ] **Step 3: Add the constant and client DocType**

In `DOCUMENT_TYPE` add:

```typescript
  SUPPORTING: "supporting",
  BANK_STATEMENT_6M: "bank_statement_6m",
```

In `components/apply/draft/types.ts`:

```typescript
export type DocType = "passport_copy" | "personal_photo" | "supporting" | "bank_statement_6m";

export const MIME_BY_TYPE: Record<DocType, string> = {
  passport_copy: "image/jpeg,image/png,application/pdf",
  personal_photo: "image/jpeg,image/png",
  supporting: "image/jpeg,image/png,application/pdf",
  bank_statement_6m: "image/jpeg,image/png,application/pdf",
};
```

No SQL enum. `document_type` is `text`.

- [ ] **Step 4: Re-run test**

```bash
pnpm exec vitest run lib/apply/document-type-constants.test.ts
```

Expected: PASS.

---

### Task 2: Service kind classifier

**Files:**
- Create: `lib/apply/service-kind.ts`
- Test: `lib/apply/service-kind.test.ts`

Catalog has no `kind` column. Classify from `name` + `durationDays` only. Do not invent prices.

```typescript
export type TServiceKind = "tourist" | "transit";

export type TServiceKindInput = {
  name: string;
  durationDays: number | null;
};

export const classifyServiceKind = (input: TServiceKindInput): TServiceKind => {
  const name = input.name.trim().toLowerCase();
  if (/\btransit\b/.test(name) || /\b48\s*h/.test(name) || /\b96\s*h/.test(name)) {
    return "transit";
  }
  if (input.durationDays === 2 || input.durationDays === 4) {
    return "transit";
  }
  return "tourist";
};

export const isChildService = (name: string): boolean => {
  const n = name.trim().toLowerCase();
  return /\bchild\b/.test(n) || /\binfant\b/.test(n) || /\bminor\b/.test(n);
};
```

- [ ] **Step 1: Write tests**

```typescript
// lib/apply/service-kind.test.ts
import { describe, expect, it } from "vitest";
import { classifyServiceKind, isChildService } from "./service-kind";

describe("classifyServiceKind", () => {
  it("marks 48h/96h and transit names as transit", () => {
    expect(classifyServiceKind({ name: "48 Hours Transit Visa", durationDays: 2 })).toBe("transit");
    expect(classifyServiceKind({ name: "96 Hours Transit", durationDays: 4 })).toBe("transit");
    expect(classifyServiceKind({ name: "Transit visa", durationDays: null })).toBe("transit");
  });

  it("marks 14/30/60 and 5-year as tourist (non-transit)", () => {
    expect(classifyServiceKind({ name: "30 Days Tourist", durationDays: 30 })).toBe("tourist");
    expect(classifyServiceKind({ name: "5 Years Multiple Entry", durationDays: 1825 })).toBe("tourist");
  });
});

describe("isChildService", () => {
  it("detects child SKUs from the catalog name", () => {
    expect(isChildService("30 Days Tourist Child")).toBe(true);
    expect(isChildService("30 Days Tourist")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm exec vitest run lib/apply/service-kind.test.ts
```

- [ ] **Step 3: Implement `lib/apply/service-kind.ts` as specified**
- [ ] **Step 4: Run — expect PASS**

---

### Task 3: Africa + Asia ISO allowlist

**Files:**
- Create: `lib/apply/nationality-regions.ts`
- Test: `lib/apply/nationality-regions.test.ts`

```typescript
export type TBankStatementRegion = "africa_asia" | "other";

/** VisaTop allowlist. TR in. RU and CY out until Francesco overrides. */
export const AFRICA_ASIA_NATIONALITY_CODES: readonly string[] = [
  // Africa
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD",
  "CI", "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE",
  "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG",
  "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG",
  "EH", "ZM", "ZW",
  // Asia (TR included; RU and CY omitted)
  "AF", "AM", "AZ", "BH", "BD", "BT", "BN", "KH", "CN", "GE", "HK", "IN", "ID",
  "IR", "IQ", "IL", "JP", "JO", "KZ", "KW", "KG", "LA", "LB", "MO", "MY", "MV",
  "MN", "MM", "NP", "KP", "OM", "PK", "PS", "PH", "QA", "SA", "SG", "KR", "LK",
  "SY", "TW", "TJ", "TH", "TL", "TR", "TM", "AE", "UZ", "VN", "YE",
] as const;

const AFRICA_ASIA_SET = new Set<string>(AFRICA_ASIA_NATIONALITY_CODES);

export const requiresAfricaAsiaBankStatementNationality = (nationalityCode: string): boolean => {
  return AFRICA_ASIA_SET.has(nationalityCode.trim().toUpperCase());
};
```

- [ ] **Step 1: Tests**

```typescript
import { describe, expect, it } from "vitest";
import { requiresAfricaAsiaBankStatementNationality } from "./nationality-regions";

describe("requiresAfricaAsiaBankStatementNationality", () => {
  it("includes India, Nigeria, Turkey, Egypt, South Africa", () => {
    for (const code of ["IN", "NG", "TR", "EG", "ZA"]) {
      expect(requiresAfricaAsiaBankStatementNationality(code)).toBe(true);
    }
  });

  it("excludes France, United States, Russia, Cyprus", () => {
    for (const code of ["FR", "US", "RU", "CY"]) {
      expect(requiresAfricaAsiaBankStatementNationality(code)).toBe(false);
    }
  });
});
```

- [ ] **Step 2–4:** FAIL → implement → PASS (`pnpm exec vitest run lib/apply/nationality-regions.test.ts`)

---

### Task 4: Document requirements resolver

**Files:**
- Create: `lib/apply/document-requirements.ts`
- Test: `lib/apply/document-requirements.test.ts`

```typescript
import { DOCUMENT_TYPE } from "@/lib/db/schema/application-document";
import { requiresAfricaAsiaBankStatementNationality } from "./nationality-regions";
import { classifyServiceKind, type TServiceKind } from "./service-kind";

export type TDocSlotRole = "required" | "additional";

export type TDocumentSlotKey =
  | typeof DOCUMENT_TYPE.PASSPORT_COPY
  | typeof DOCUMENT_TYPE.PERSONAL_PHOTO
  | typeof DOCUMENT_TYPE.BANK_STATEMENT_6M;

export type TDocumentSlot = {
  key: TDocumentSlotKey;
  label: string;
  description: string;
  role: TDocSlotRole;
  acceptMime: string;
  maxBytes: number;
};

export const DOCUMENT_SLOT_MAX_BYTES = 8 * 1024 * 1024;

const PASSPORT_SLOT: TDocumentSlot = {
  key: DOCUMENT_TYPE.PASSPORT_COPY,
  label: "Passport (bio page)",
  description: "JPEG / PNG / single-page PDF · 8MB max",
  role: "required",
  acceptMime: "image/jpeg,image/png,application/pdf",
  maxBytes: DOCUMENT_SLOT_MAX_BYTES,
};

const PHOTO_SLOT: TDocumentSlot = {
  key: DOCUMENT_TYPE.PERSONAL_PHOTO,
  label: "Personal photo",
  description: "JPEG or PNG · 8MB max",
  role: "required",
  acceptMime: "image/jpeg,image/png",
  maxBytes: DOCUMENT_SLOT_MAX_BYTES,
};

const BANK_SLOT: TDocumentSlot = {
  key: DOCUMENT_TYPE.BANK_STATEMENT_6M,
  label: "Last 6 months bank account statement",
  description: "One PDF or image covering the last 6 months · JPEG / PNG / PDF · 8MB max",
  role: "required",
  acceptMime: "image/jpeg,image/png,application/pdf",
  maxBytes: DOCUMENT_SLOT_MAX_BYTES,
};

export type TResolveDocumentRequirementsInput = {
  nationalityCode: string;
  serviceName: string;
  durationDays: number | null;
  serviceKind?: TServiceKind;
};

export const resolveDocumentRequirements = (
  input: TResolveDocumentRequirementsInput,
): TDocumentSlot[] => {
  const kind = input.serviceKind ?? classifyServiceKind({
    name: input.serviceName,
    durationDays: input.durationDays,
  });
  const slots: TDocumentSlot[] = [PASSPORT_SLOT, PHOTO_SLOT];
  if (
    kind !== "transit" &&
    requiresAfricaAsiaBankStatementNationality(input.nationalityCode)
  ) {
    slots.push(BANK_SLOT);
  }
  return slots;
};

export const requiredDocumentTypeKeys = (slots: TDocumentSlot[]): TDocumentSlotKey[] =>
  slots.filter((s) => s.role === "required").map((s) => s.key);
```

- [ ] **Step 1: Tests (must include these cases)**

```typescript
import { describe, expect, it } from "vitest";
import { DOCUMENT_TYPE } from "@/lib/db/schema/application-document";
import { resolveDocumentRequirements, requiredDocumentTypeKeys } from "./document-requirements";

const tourist30 = { serviceName: "30 Days Tourist", durationDays: 30 };
const transit48 = { serviceName: "48 Hours Transit Visa", durationDays: 2 };

describe("resolveDocumentRequirements", () => {
  it("India + 30-day tourist includes bank statement", () => {
    const keys = requiredDocumentTypeKeys(resolveDocumentRequirements({ nationalityCode: "IN", ...tourist30 }));
    expect(keys).toEqual([
      DOCUMENT_TYPE.PASSPORT_COPY,
      DOCUMENT_TYPE.PERSONAL_PHOTO,
      DOCUMENT_TYPE.BANK_STATEMENT_6M,
    ]);
  });

  it("Nigeria + 30-day tourist includes bank statement", () => {
    const keys = requiredDocumentTypeKeys(resolveDocumentRequirements({ nationalityCode: "NG", ...tourist30 }));
    expect(keys).toContain(DOCUMENT_TYPE.BANK_STATEMENT_6M);
  });

  it("France + 30-day tourist has no bank statement", () => {
    const keys = requiredDocumentTypeKeys(resolveDocumentRequirements({ nationalityCode: "FR", ...tourist30 }));
    expect(keys).toEqual([DOCUMENT_TYPE.PASSPORT_COPY, DOCUMENT_TYPE.PERSONAL_PHOTO]);
  });

  it("India + transit has no bank statement", () => {
    const keys = requiredDocumentTypeKeys(resolveDocumentRequirements({ nationalityCode: "IN", ...transit48 }));
    expect(keys).not.toContain(DOCUMENT_TYPE.BANK_STATEMENT_6M);
  });

  it("Nigeria + transit has no bank statement", () => {
    const keys = requiredDocumentTypeKeys(resolveDocumentRequirements({ nationalityCode: "NG", ...transit48 }));
    expect(keys).not.toContain(DOCUMENT_TYPE.BANK_STATEMENT_6M);
  });

  it("India + 5-year tourist includes bank statement", () => {
    const keys = requiredDocumentTypeKeys(
      resolveDocumentRequirements({
        nationalityCode: "IN",
        serviceName: "5 Years Multiple Entry",
        durationDays: 1825,
      }),
    );
    expect(keys).toContain(DOCUMENT_TYPE.BANK_STATEMENT_6M);
  });
});
```

- [ ] **Step 2–4:** FAIL → implement → PASS

---

### Task 5: Customer-safe upload slot

**Files:**
- Modify: `components/apply/draft/document-upload-slot.tsx`
- Test: `lib/apply/customer-upload-copy.test.ts` (pure helper — do not leak internals from the component)

Customer must see: **document type label, Uploaded / Not uploaded, Replace**. Never: `originalFilename`, raw `id`, `byteLength`, KB, `status` enum, `needs_manual`.

```typescript
// lib/apply/customer-upload-copy.ts
export const customerUploadStateLabel = (hasDoc: boolean): "Uploaded" | "Not uploaded yet" =>
  hasDoc ? "Uploaded" : "Not uploaded yet";
```

```typescript
// lib/apply/customer-upload-copy.test.ts
import { describe, expect, it } from "vitest";
import { customerUploadStateLabel } from "./customer-upload-copy";

describe("customerUploadStateLabel", () => {
  it("never mentions bytes or filenames", () => {
    expect(customerUploadStateLabel(true)).toBe("Uploaded");
    expect(customerUploadStateLabel(false)).toBe("Not uploaded yet");
  });
});
```

Then rewrite the uploaded branch in `document-upload-slot.tsx` to:

```tsx
{currentDoc ? (
  <div className="space-y-2">
    <p className="text-success text-sm font-medium">{customerUploadStateLabel(true)}</p>
    <a
      href={apiHref(`/applications/${applicationId}/documents/${currentDoc.id}/preview`)}
      target="_blank"
      rel="noreferrer"
      className="text-link text-xs hover:underline"
    >
      Preview
    </a>
  </div>
) : (
  <p className="text-muted-foreground text-xs">{customerUploadStateLabel(false)}</p>
)}
```

Keep camera + file pickers. Replace button stays. Do not display `currentDoc.originalFilename` or `currentDoc.byteLength`.

- [ ] **Step 1–4:** test helper FAIL → implement helper → PASS → patch component.

---

### Task 6: Dynamic `DraftDocumentsSection`

**Files:**
- Modify: `components/apply/draft/draft-documents-section.tsx`
- Modify: `components/apply/draft/use-application-draft.ts`
- Modify: `components/apply/application-draft-panel.tsx`

Section props become slot-driven:

```typescript
import type { TDocumentSlot } from "@/lib/apply/document-requirements";
import type { DocType, PublicDocument } from "./types";

export interface IDraftDocumentsSectionProps {
  applicationId: string;
  slots: TDocumentSlot[];
  docsByType: Partial<Record<DocType, PublicDocument | null>>;
  uploading: DocType | null;
  extracting: boolean;
  onUpload: (type: DocType, file: File) => void;
}
```

- Render **required** slots first, then an “Additional documents” heading only if any `role === "additional"` (v1 has none).
- Drop the vague “team will contact you for bank statements” paragraph when a bank slot is already in `slots`.
- Do **not** show `attemptsLeft`, `needs_manual`, or retry counts. If extraction failed, parent may pass a single customer sentence (Task 8).
- `onUpload` must accept `bank_statement_6m` the same as passport/photo (existing upload API already takes `documentType` text).

In the draft hook / panel: resolve slots with `resolveDocumentRequirements` using `app.nationalityCode` plus the catalog service `name` / `durationDays` (fetch catalog like `checkout-order-recap.tsx` does, or pass service fields from the application page loader). Do not hard-code India.

`latestByType` in `utils.ts` must treat `bank_statement_6m`.

- [ ] **Step 1:** Grep and remove hard-coded two-slot grid.
- [ ] **Step 2:** Wire resolver + map uploads.
- [ ] **Step 3:** `pnpm exec vitest run lib/apply/document-requirements.test.ts lib/apply/customer-upload-copy.test.ts`

---

### Task 7: Retention includes bank statement when uploaded

**Files:**
- Modify: `lib/applications/retain-required-documents.ts`
- Modify: `lib/applications/retain-required-documents.test.ts`

Change `REQUIRED_RETENTION_TYPES` to:

```typescript
export const REQUIRED_RETENTION_TYPES: readonly DocumentType[] = [
  DOCUMENT_TYPE.PASSPORT_COPY,
  DOCUMENT_TYPE.PERSONAL_PHOTO,
  DOCUMENT_TYPE.BANK_STATEMENT_6M,
] as const;
```

Existing behavior stays: **missing types are skipped** (pay-first). Only `uploaded_temp` **without** bytes is `BLOB_BYTES_MISSING`.

Add a test: temp `bank_statement_6m` with bytes → retained; no bank row → success with passport/photo only.

- [ ] **Step 1:** Extend the existing test file (follow its mock/tx style).
- [ ] **Step 2:** FAIL → update implementation → PASS

```bash
pnpm exec vitest run lib/applications/retain-required-documents.test.ts
```

---

### Task 8: Customer OCR copy + expiry warning (not a block)

**Files:**
- Modify: `components/apply/draft/utils.ts` (`customerFacingExtractionLabel`)
- Modify: `components/apply/draft/applicant-review.tsx`
- Create: `lib/apply/ocr-customer-copy.ts` + test

```typescript
export const OCR_UNCLEAR_COPY =
  "We could not read some details clearly. Review the highlighted fields.";

export const customerFacingExtractionLabel = (status: string | null | undefined): string => {
  switch (status) {
    case "running":
      return "Reading your passport…";
    case "succeeded":
      return "Details filled in — please check they are correct.";
    case "needs_manual":
    case "failed":
      return OCR_UNCLEAR_COPY;
    default:
      return "";
  }
};
```

Never return the string `needs_manual`. Do not show attempt counts.

Passport expiry: if the expiry date is in the past or within 6 months, show a warning **next to the field**. Do **not** disable Pay. Keep `APPLY_STEP3_VALIDATION_DISABLED === true`.

```typescript
export const passportExpiryWarning = (isoDate: string | null, now = new Date()): string | null => {
  if (!isoDate) return null;
  const exp = new Date(isoDate);
  if (Number.isNaN(exp.getTime())) return null;
  if (exp.getTime() < now.getTime()) {
    return "This passport looks expired. You can still pay — we may need an updated passport to process.";
  }
  const inSixMonths = new Date(now);
  inSixMonths.setMonth(inSixMonths.getMonth() + 6);
  if (exp.getTime() < inSixMonths.getTime()) {
    return "This passport expires soon. You can still pay — we may need a longer validity to process.";
  }
  return null;
};
```

Tests for past / soon / far-future. Wire `passportExpiryWarning` under the expiry input in `ApplicantReview`.

---

### Task 9: Payment copy never says “complete” when slots/fields are empty

**Files:**
- Create: `lib/apply/payment-copy.ts` + `lib/apply/payment-copy.test.ts`
- Modify: `components/apply/draft/draft-payment-section.tsx`
- Modify: `components/apply/draft/applicant-review.tsx` (`buildReadinessLabel`)

```typescript
export const PAY_FIRST_INCOMPLETE_COPY =
  "Pay now to start processing. You can add remaining documents and details after payment.";

export const PAY_FIRST_COMPLETE_COPY =
  "Review your order and pay securely to begin processing.";

export type TPayCopyInput = {
  requiredSlotKeys: string[];
  uploadedTypes: string[];
  hasFullName: boolean;
  hasDateOfBirth: boolean;
  hasPassportNumber: boolean;
};

export const customerLooksCompleteForPayCopy = (input: TPayCopyInput): boolean => {
  const uploaded = new Set(input.uploadedTypes);
  const slotsOk = input.requiredSlotKeys.every((k) => uploaded.has(k));
  return slotsOk && input.hasFullName && input.hasDateOfBirth && input.hasPassportNumber;
};

export const initiatePaymentBody = (complete: boolean): string =>
  complete ? PAY_FIRST_COMPLETE_COPY : PAY_FIRST_INCOMPLETE_COPY;
```

Tests: India tourist with empty uploads → incomplete copy; all slots + name/DOB/passport → complete copy.

Replace *“Your application is complete and ready for submission…”* in `draft-payment-section.tsx`.

Change `buildReadinessLabel` so pay-first never shows a green “Ready for payment” that implies docs are done. Use “Continue to payment” when `APPLY_STEP3_VALIDATION_DISABLED` and slots are empty.

---

### Task 10: Country name + product name (not `IN` / raw service id)

**Files:**
- Create: `lib/apply/display-names.ts` + test
- Modify: `components/apply/draft/applicant-review.tsx` (nationality placeholder / value)
- Modify track API + `components/apply/application-track-lookup-form.tsx`
- Modify signed-in track list if it also prints `serviceId` / `nationalityCode`

```typescript
export const nationalityDisplayName = (
  code: string,
  catalog: Array<{ code: string; name: string }>,
): string => {
  const upper = code.trim().toUpperCase();
  return catalog.find((n) => n.code === upper)?.name ?? upper;
};
```

Prefill step-3 nationality field from step-1 `nationalityCode` via catalog **name** when `applicant.nationality` is empty.

Track lookup JSON today: `serviceId`, `nationalityCode`. Add `serviceName` and `nationalityName` (join `visa_service` + `nationality` in `findApplicationsForContactTrackLookup` or in the route mapper). UI:

```tsx
<p className="text-muted-foreground text-xs">
  {row.serviceName} · {row.nationalityName}
</p>
```

Do not show the UUID. If the join misses, fall back to the catalog name helper, never `Service ${id}`.

Add/extend `app/api/applications/track-lookup/route.test.ts` and `lib/applications/track-lookup.test.ts` for the new fields.

---

### Task 11: Phase A verification

```bash
pnpm exec vitest run lib/apply lib/applications/retain-required-documents.test.ts app/api/applications/track-lookup/route.test.ts
pnpm run lint
```

Manual smoke (orchestrator, not OpenCode): India 30-day → three slots; France 30-day → two; any transit → two; pay copy with empty docs ≠ “complete”; upload UI has no KB/filename.

**Phase A done when:** resolver tests green, customer UI hides internals, retention skips missing bank, track shows names.

---

## Suggested commit (only if orchestrator asks)

```
feat(apply): dynamic document slots and customer-safe pay-first copy
```
