# Admin catalog list-then-edit UX

Date: 2026-09-06  
Status: Approved (2026-09-06)  
Implementation plan: [2026-09-06-admin-catalog-list-edit-ux.md](../plans/2026-09-06-admin-catalog-list-edit-ux.md)  
Do not commit until the user asks.

## Problem

The admin Catalog page (`/admin/catalog`) puts nationalities, visa services, and service↔nationality eligibility on one screen. Service and nationality rows are inline inputs with a Save button. Eligibility is a global dump table plus a “link service + nationality” form.

That is hard to scan, easy to mis-edit, and unlike Document rules, which already uses a read-only list, then a dedicated page, then a nested country/service list.

## Goal

Replace the Catalog dump with the same list-then-act pattern as Document rules:

- Lists are read-only. Add / Edit / Delete (or Open) are actions.
- Forms live on dedicated pages.
- Eligibility is nationality-first on the nationality page, and also visible from the service edit page (bidirectional).
- No editable inputs inside hub table/list rows.

## Non-goals

- Pricing UI or import (`/admin/pricing`, customer-price APIs).
- Changing Document rules assignment logic, extras, or passport/photo floor.
- Public apply catalog APIs (`listPublicServicesForNationality` and related).
- Scraping or automated price sync.
- Inventing a new eligibility data model. `visa_service_eligibility` stays the source of truth.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Hub IA | One Catalog URL with **Services** and **Nationalities** tabs |
| Add / Edit | Dedicated pages (same idea as Add document) |
| Open nationality | Combined page: country fields on top, eligible services below |
| Eligibility | Nationality-first, plus eligible countries on the service edit page |
| Linking new pairs | Dedicated picker pages of unlinked items; multi-select then confirm |
| Nav label | Rename current “Services” item to **Catalog** |

## Information architecture

Admin nav `catalog` key stays. Label becomes **Catalog**. Overview card title becomes **Catalog**; description stays “Manage services and nationalities.”

### Routes

| Route | Purpose |
|---|---|
| `/admin/catalog?tab=services` | Default hub tab. Read-only visa services list. |
| `/admin/catalog?tab=nationalities` | Read-only nationalities list. |
| `/admin/catalog/services/new` | Create service. |
| `/admin/catalog/services/[id]/edit` | Edit service fields + eligible nationalities list. |
| `/admin/catalog/services/[id]/nationalities/add` | Picker: unlinked nationalities for this service. |
| `/admin/catalog/nationalities/new` | Create nationality. |
| `/admin/catalog/nationalities/[code]` | Combined: name/enabled + eligible services. |
| `/admin/catalog/nationalities/[code]/services/add` | Picker: unlinked services for this nationality. |

Unknown `tab` values fall back to `services`. Missing service id or nationality code renders the existing admin access/404 card pattern (not a blank page).

### Removed from `/admin/catalog`

- Inline-edit nationality rows (name input, enabled checkbox, Save).
- Inline-edit service rows (name/duration/entries/enabled inputs, Save).
- The eligibility dump table, filters, and “link a new service to an existing nationality” form.
- `?prefillNat=` scroll-to-eligibility behavior.

### Redirects

Document rules “Add eligibility” links (today `/admin/catalog?prefillNat=XX#catalog-eligibility`) go to `/admin/catalog/nationalities/[code]`.

## Page UX

Admin skin, tokens, and density follow `.impeccable.md` (structured, high-contrast, desktop-first) and `DESIGN.md`. Use existing shadcn primitives and Document rules list/card patterns. Do not invent hex colors.

### Hub lists

Match `DocumentRulesWorkspace`:

- Search + paginated read-only rows.
- One primary **Add** button (write only).
- Service row: name, duration, entries, On/Off badge, **Edit**, **Delete**.
- Nationality row: ISO code, name, On/Off badge, **Open**, **Delete**.
- Empty states: no rows vs no search matches.
- No inputs in rows. Enabled is a badge, not a checkbox.

### Create pages

Small forms with a back link to the matching hub tab.

- Service: name (required), duration days (optional), entries (optional), enabled default on. Id is generated server-side.
- Nationality: ISO alpha-2 code (required, 2 letters, stored uppercase), display name (required), enabled default on.

On success: service → `/admin/catalog/services/[id]/edit`. Nationality → `/admin/catalog/nationalities/[code]`.

### Nationality combined page

- Back link: Catalog · Nationalities (`/admin/catalog?tab=nationalities`).
- Code is read-only. Name and enabled are editable. **Save** updates those fields only.
- Below: **Eligible services** — read-only list (name, “No price — hidden on apply” when unpriced, **Remove**).
- **Add service** → picker page.
- Empty: “No eligible services. Add a service to offer a product for this nationality.”

### Service edit page

- Back link: Catalog · Services (`/admin/catalog?tab=services`).
- Fields: name, duration, entries, enabled. **Save**.
- Below: **Eligible nationalities** — read-only list (code, name, **Remove**).
- **Add nationality** → picker page.
- Empty: “No eligible nationalities. Add a nationality to offer this product.”

### Picker pages

- Show only items not already linked.
- Multi-select checkboxes are allowed here: choose, then one **Add** confirm. This is not an editable data table.
- Empty: “All services are already linked.” / “All nationalities are already linked.”
- Cancel / back returns to the parent nationality or service page.

### Delete and remove

- Delete service or nationality: existing `ConfirmDialog`. Destructive confirm. Copy must say that allowed deletes also remove eligibility, customer prices, and extra document rules for that row. Applications are not deleted.
- Remove eligibility: confirm, then `DELETE` the pair. Eligibility removal never deletes the service or nationality.
- If delete is blocked (`409`), keep the row and show the server message. Operator should disable instead.

### Permissions

- `catalog.read`: view hub, detail, and pickers (pickers have no write controls).
- Write actions require `catalog.write` and `audit.write` (same as today). Hide Add/Edit/Delete/Save/Remove/picker confirm without write.

## Data flow and APIs

Actor context, JSON envelope (`jsonOk` / `jsonError`), `x-request-id`, `export const runtime = "nodejs"`, and admin audit on every write stay mandatory.

### Reuse

| Method | Path | Use |
|---|---|---|
| GET/POST | `/api/admin/catalog/nationalities` | List / create |
| PATCH | `/api/admin/catalog/nationalities/[code]` | Name, enabled |
| GET/POST | `/api/admin/catalog/visa-services` | List / create |
| PATCH | `/api/admin/catalog/visa-services/[id]` | Fields |
| GET | `/api/admin/catalog/eligibility?nationalityCode=` or `?serviceId=` | Nested lists |
| POST | `/api/admin/catalog/eligibility` | Existing single-pair body still works |
| DELETE | `/api/admin/catalog/eligibility` | Remove one pair |

Hub may keep SSR via `loadCatalogPage` (nationalities + services). Nested eligibility stays paged via GET.

### New / extended

1. **Bulk eligibility create.** Extend `POST /api/admin/catalog/eligibility` to accept `{ pairs: [{ serviceId, nationalityCode }] }` in addition to the current single-pair body. One transaction. Invalid pair or missing parent fails the whole request. Existing `onConflictDoNothing` dedupe stays; already-linked pairs are a quiet success. Write one audit row per newly created pair (`catalog.eligibility.create`), same as today’s single-pair POST. Deduped pairs get no extra audit row.

2. **DELETE nationality** `DELETE /api/admin/catalog/nationalities/[code]`.

3. **DELETE visa service** `DELETE /api/admin/catalog/visa-services/[id]`.

Delete rules:

- If any `application` row references that nationality code or service id, return `409` with a clear message to disable instead of delete. Application FKs do not cascade.
- When delete is allowed, `visa_service_eligibility` (and customer prices that already `ON DELETE CASCADE` from the service) go away with the row.
- Audit `catalog.nationality.delete` / `catalog.visa_service.delete` with beforeJson.

### Errors

- Create/edit pages: show envelope `message` on the form; keep field values.
- Missing resource: admin 404 card.
- Deduped eligibility: success, no error toast.
- Read-only users: no write controls, no client-side 403 surprises.

## Testing

TDD for new/changed API behavior:

- Bulk `POST` eligibility: happy path, empty `pairs`, invalid pair rolls back, dedupe, 401 / missing permission.
- `DELETE` nationality and visa service: success when unused, `409` when an application references the row, `404` when missing, 401 / missing permission.
- Keep existing GET/PATCH catalog tests; update only what new request shapes break.

No new component unit tests unless a shared list helper becomes non-trivial. Catalog workspace has none today.

Browser verification before done:

- Hub tabs and `?tab=` persistence.
- Create service → edit page; create nationality → combined page.
- Add/remove eligibility from both sides; picker empty state.
- Delete blocked vs allowed.
- Read-only role hides write actions.
- Document rules “Add eligibility” opens the nationality page.
- Desktop width, light and dark.

CI: `pnpm run lint && pnpm run test:ci && pnpm run build`.

## Implementation notes (for the plan, not extra product scope)

- Split `catalog-workspace.tsx` into hub + page components. Do not keep a 600-line inline-edit workspace.
- Reuse `ListPaginatorBar`, `usePaginatedList`, `ConfirmDialog`, Document rules card chrome.
- Follow repo conventions: `T` types, `I` props interfaces, arrow functions, `FC` components.
- `catalog-document-rules-table.tsx` is Document rules, not this hub. Do not fold it back onto Catalog.
- Public apply still uses priced eligibility. Unpriced eligible pairs stay hidden on apply; admin still shows the warning.

## Out of scope leftovers

- Bulk enable/disable from the hub.
- Keyboard shortcuts.
- Changing ISO code after create.
- Bidirectional deep-links beyond the routes listed above.
