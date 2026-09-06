# Admin-controlled document requirements (bulk Document rules)

> Same release train as [Phase A](../plans/2026-09-05-tourist-journey-phase-a-trust-and-docs.md) / PR [#8](https://github.com/alfaroukhesham/visatop-next-js/pull/8).  
> Implementation plan: [2026-09-05-admin-document-requirements.md](../plans/2026-09-05-admin-document-requirements.md).  
> Do not commit until the user approves.

**Status:** Implementing (2026-09-06). Country-first Document rules; Eligibility ≠ buyable; unpriced admin warning.

## Problem

On `#8`, extra-document **policy** is still in git (`nationality-regions.ts`, `classifyServiceKind`, `resolveDocumentRequirements`). Francesco cannot add Russia, drop India, or mark bank as additional on a set of SKUs without a deploy.

A Documents column on each Eligibility row is the wrong tool: hundreds of country × product rows, no required-vs-additional, no bulk.

## Release train

Implement **on top of** `feat/tourist-journey-phase-a` (PR #8). Same train to `main`. Do not rebuild Phase A against `main`.

## Decision

**Passport + personal photo are hard required defaults in code.** They are not stored, not shown as toggles, and cannot be turned off.

**Extras** (today: `bank_statement_6m`) live in `catalog_document_requirement` as **additions**, each with `required` or `additional`. Admin assigns them to **explicit country × eligible-service pairs** — not a global country list times a global service list.

Admin surface: Catalog → **Document rules** (own section). Not a column on the Eligibility table.

Apply = locked floor + extras for that nationality × service. No ISO allowlist and no transit name classifier on the customer path after cutover.

## Apply visibility (price, not Eligibility)

On `#8`, the public catalog (`listPublicServicesForNationality`) lists products that have a **`catalog_customer_price`** row for that nationality. `visa_service_eligibility` is an admin / price-import companion. It does **not** put a SKU on the apply grid.

**Fallback (keep / do not regress):** Eligible + **no price** → **hidden from customers**. Do not start listing eligible-unpriced products. Do not switch apply to “eligible OR priced.”

**Admin warning:** Eligible pairs with no `catalog_customer_price` must show a visible warning (Eligibility table + Document rules picker): “No price — hidden on apply.” Assigning documents to those pairs is allowed (docs can land before a price). The warning is display-only.

**Do not change** `lib/admin/catalog/apply-customer-price-import.ts` / `syncEligibilityForTouchedPairs` / the XLSX import routes. Import stays as it works today.

## Stays in code — leave intact on `#8`

| Thing | Where on `#8` | This PR |
|---|---|---|
| Type keys | `DOCUMENT_TYPE` including `bank_statement_6m` | Do not rename / remove |
| Slot presentation | `PASSPORT_SLOT` / `PHOTO_SLOT` / `BANK_SLOT` in `document-requirements.ts` | **Extract** into `document-slot-catalog.ts` — same copy |
| Locked floor | Passport + photo always first | Resolver always prepends them as `required` |
| Upload + MIME for bank | `document-upload.ts`, upload route | **Leave intact** |
| Retain (skip if missing) | `REQUIRED_RETENTION_TYPES` includes bank | **Do not regress** |
| Pay-first | Empty slots never block Pay | Unchanged |
| Customer Additional section | `draft-documents-section.tsx` splits `role === "additional"` | **Use it.** Extras with `additional` appear there |
| Type registry | Admin cannot invent a new `document_type` string | Assignable extras = registry minus floor keys. v1 extra: bank only |

## Leaves the apply path

- Runtime `AFRICA_ASIA_NATIONALITY_CODES`
- Resolver calling `classifyServiceKind` / `requiresAfricaAsiaBankStatementNationality`
- Client computing slots from nationality + service **name**

Seed SQL copies those functions **once**. They must not run on apply after cutover.

## Data model

Table stores **extras only**. Never `passport_copy` or `personal_photo`.

```
catalog_document_requirement
  id                 text PK
  nationality_code   text FK nationality.code ON DELETE CASCADE
  service_id         text FK visa_service.id ON DELETE CASCADE
  document_type      text  -- v1: bank_statement_6m only
  role               text  -- required | additional
  created_at         timestamptz
  UNIQUE (nationality_code, service_id, document_type)
```

CHECK (or app reject on every write): `document_type` is not a floor key; `role IN ('required','additional')`.

Deleting an Eligibility row cascades extras for that pair. Removing an extra **never** deletes Eligibility.

### Migration number

Latest SQL on `#8` is `0021_visa_service_name_unique.sql`.

| Work | File |
|---|---|
| **This PR** | `drizzle/0022_catalog_document_requirement.sql` (table + seed extras only) |
| Phase B party | `drizzle/0023_application_party.sql` |

RLS: copy eligibility in `drizzle/0003_catalog_addon_rls.sql` — `catalog.read` / `catalog.write` for admin; **system SELECT** for public apply via `withSystemDbActor`.

## Apply behavior

1. Draft hook loads `GET /api/catalog/services?nationality=&currency=`.
2. Each service includes `documentTypes: { key, role }[]` — **extras only** (empty array = no extras).
3. `resolveDocumentRequirements(extras)` always returns `[passport, photo, ...mapped extras]`. Unknown keys ignored. Floor keys in extras are ignored (no duplicate slots). Extra `role` overlays the slot catalog default.
4. Customer UI: `required` extras sit with passport/photo; `additional` extras use the existing Additional block.
5. Pay-first unchanged.

### Live drafts

Not new-draft-only. No server rewrite, email, or file delete. Open drafts pick up extras on the **next catalog load** (nationality / service / currency change, remount, refresh). Removing an extra hides the slot after that load; an already-uploaded file stays.

## Admin journey — Document rules

Own section on the existing Catalog workspace (`AdminCatalogWorkspace`), **after** Eligibility. Same `catalog.read` / `catalog.write` / `audit.write`. Put `id="catalog-eligibility"` on the Eligibility card so Document rules can jump there.

**Locked banner:** “Every application always needs passport + personal photo. Those cannot be turned off.”

### Picker (not two global lists)

Do **not** show one list of all countries and a second list of all services (that cartesian is how you accidentally link France to a product they should not buy).

Show **each country**, and under it **only that country’s eligible services**.

```
[Search countries]

India                              [Select all eligible]  [Add eligibility]
  ☑ 30-day tourist
  ☑ 5-year multiple entry
  ☐ Transit 48h

France                             [Select all eligible]  [Add eligibility]
  ☑ 30-day tourist
  (no other products — use Add eligibility)
```

- Search filters countries.
- **Select all eligible** applies to that country only.
- A country with zero links still appears (empty service list) so Francesco can use **Add eligibility**.
- **Add eligibility** is a link/button: scroll to `#catalog-eligibility`, prefills that nationality on the existing “Link a new service” form. He adds the product there, then the service shows under that country after refresh. That is the normal way to add an admin Eligibility link. A price is still required before the SKU appears on apply.
- Eligible service with no price: still listed in this picker (so he can assign docs) with the **No price — hidden on apply** warning.

### Assign (bulk)

1. Document — assignable extras (v1: *Last 6 months bank statement*).
2. Role — **Required** or **Additional**.
3. Tick services under one or more countries (eligible list only in the UI).
4. Payload is **explicit pairs** `{ nationalityCode, serviceId }[]` — not `countries[] × services[]`.
5. **Preview** (server): `pairCount`, `alreadyEligible`, `willCreateEligibility`, `pairsWithoutPrice`, extras insert vs role-update.
6. **Eligibility warning (required if `willCreateEligibility > 0`):** blocking confirm. Exact intent: “This will also create **Eligibility** admin links for **N** pairs. It does **not** set prices — products only appear on apply when a catalog price exists.” Do **not** say they “will become able to buy” those products. Cancel = no write. This path is a **stale-UI safety net** only — the picker does not offer an all-services list.
7. If some selected pairs have no price, the same confirm (or the short confirm) must also say: “**M** of these pairs have no catalog price and stay hidden on apply until you add a price (Pricing or sheet import).”
8. If `willCreateEligibility === 0` and all selected pairs have a price, a short confirm is enough (“Set this document on **N** eligible pairs”).
9. Apply on the explicit pairs:
   - Upsert the extra (`ON CONFLICT` update `role`).
   - Missing Eligibility: upsert (`ON CONFLICT DO NOTHING`) **only after** the warning above.
   - Never write prices. Never write passport/photo rows.
   - Cap: `pairs.length > 2000` → `400 DOCUMENT_REQUIREMENTS_PAIR_LIMIT`.
   - Unknown nationality or service → `400`. Floor type → `400`.

### Remove (bulk)

Same country → eligible-service picker + document type. Deletes matching extra rows only. **Does not** unlink Eligibility. Preview: “Remove this document from **N** pairs. Eligibility links stay.”

### Review table

Paginated extras: country · service name · document · required/additional · remove-this-row. Filters: nationality, service, document type. Single-row remove = one extra, no Eligibility change.

Price-sheet import / manual Eligibility create: **no** extra rows. New pairs show passport + photo only until someone assigns an extra.

## Seed (one-time) — extras only, copy `#8` literally

Do **not** insert passport or photo.

Insert `bank_statement_6m` / `required` for every **existing** `visa_service_eligibility` pair where **both**:

- `nationality_code` is in this exact `#8` list (TR in; RU and CY omitted):

```
DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE
LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG
EH ZM ZW
AF AM AZ BH BD BT BN KH CN GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV
MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE
```

- Service is **not** transit, same `classifyServiceKind` as `#8`:

```
name matches /\btransit\b/  OR  /\b48\s*h/  OR  /\b96\s*h/
OR durationDays === 2  OR  durationDays === 4
```

SQL must be equivalent. Paste the ISO codes — do not rebuild from memory.

After seed + apply cutover, delete the allowlist from the resolver.

## Audit

One audit per bulk action (not one row per pair):

- `catalog.document_requirement.bulk_assign` — type, role, pair ids, `eligibilityCreated`, `upserted`
- `catalog.document_requirement.bulk_remove` — type, country codes, service ids, `deleted`
- `catalog.document_requirement.remove` — single review-row delete

`afterJson` / `beforeJson`: ids and counts only. No PII.

## Out of scope

- New document *types* beyond the `#8` registry (adding a type is still a code change)
- CSV/XLSX import of extras
- Any change to the working customer-price sheet import
- Per-row checkboxes on the Eligibility table
- A global “all countries” × “all services” picker
- Admin editing or removing passport/photo
- Unlinking Eligibility when removing a document
- Phase B party (reuse the same resolver per traveler)
- Payment “complete” copy on `#8`
- Rewriting in-flight drafts
