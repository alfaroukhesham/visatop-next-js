# Client brand theme (Visatop) — implementation plan

Date: 2026-04-22  
Related design spec: [`2026-04-20-client-brand-theme-design.md`](../specs/2026-04-20-client-brand-theme-design.md)  
Brand reference: [`website-brand-guidlines-summary.md`](../../../website-brand-guidlines-summary.md) (repo root)

## Purpose

Implement a **client-only** rebrand (full refit) so every **non-admin** route matches the company brand guidelines, while **admin** keeps the current design system and **light + dark** behavior unchanged.

This document is the **implementation plan** companion to the design spec. It is written to be mechanically actionable in this Next.js App Router codebase.

---

## Merge order (gate)

**Do not start Phase 1 (route moves) or Phase 2 (`(client)` layout) until Phase 0 is merged.**  
Phase 0 removes the root-layout `ThemeProvider` trap; later phases assume that invariant.

---

## Invariants (must hold after implementation)

- **Invariant A — Client is light-only**  
  Client UI must not be influenced by a persisted **`html` dark class** (e.g. after admin dark mode + navigation to `/`). Client subtree uses `color-scheme: light` on `.theme-client`, and non-admin routes must clear or neutralize dark on `<html>` per **Phase 0 + persisted-theme strategy** below.

- **Invariant B — Admin unchanged**  
  Admin pages keep existing `ThemeProvider` + `ThemeToggle` behavior and existing `:root` / `.dark` token behavior.

- **Invariant C — Mandatory client wrappers at UI boundaries**  
  Under `app/(client)/**`, user-visible UI boundaries must use `Client*` wrappers:
  - buttons/CTAs
  - nav links
  - hero/highlight surfaces (cut-corner motif)
  - cards (elevation + rounding)
  - form fields (inputs/selects/textareas + label/help/error)

**Escape hatch (explicit):** raw shadcn primitives are allowed only:

- inside `components/client/**` wrapper implementations,
- for third-party widgets that cannot be reasonably wrapped,
- on admin routes.

### Shared `components/` vs client boundaries

Primitives under `components/ui` and other shared modules stay **neutral** and reusable by both skins. **`app/(client)/**` pages** compose **`Client*`** at boundaries; admin pages keep composing raw shadcn (or admin-specific patterns) so refactors do not accidentally restyle admin.

---

## Phase 0 — Relocate `ThemeProvider` + `ThemeToggle` (admin subtree only)

### Problem

`ThemeProvider` cannot be omitted from `app/(client)/layout.tsx` if it remains in `app/layout.tsx`, because the root layout wraps **all** routes (admin + client).

### Required change

**Move `ThemeProvider` and `ThemeToggle` out of `app/layout.tsx` into an admin-only layout subtree**, for example:

- `app/admin/layout.tsx` (recommended if it wraps all `/admin/**` routes), **or**
- split between `app/admin/sign-in/layout.tsx` and `app/admin/(protected)/layout.tsx` if sign-in must not inherit the same chrome.

### Outcome

- Client route trees do not mount the full theme provider stack.
- Admin behavior matches today for light/dark toggling **on admin routes**.

### Gate (repeated)

**No `(client)` route-group work (Phase 1+) until Phase 0 merges.**

---

## Phase 0b — Persisted `html.dark` and admin → client navigation

`next-themes` is configured with `attribute="class"` (see `components/theme-provider.tsx`), so **dark mode applies a class on `<html>`** (typically `dark`). If `ThemeProvider` only mounts under `/admin`, a user can still leave **`class="dark"` on `<html>`** after visiting admin, then navigate to `/` — **client pages would still inherit dark tokens from `:root`/`.dark` in `globals.css`** unless we explicitly handle it.

**Required: document and implement one approach so Invariant A holds in real usage.**

### Recommended approach (single, explicit)

Add a **small client component** mounted from **`app/layout.tsx` (root)** — e.g. `ThemeClassSync` — that:

- uses `usePathname()` (or equivalent) to detect **non-admin** routes (e.g. pathname does **not** start with `/admin`);
- on **non-admin** routes: **remove `dark` from `document.documentElement.classList`** (and optionally set `document.documentElement.style.colorScheme = 'light'` if needed beyond `.theme-client`);
- on **`/admin/**`**: **no-op** — let admin’s `ThemeProvider` + `ThemeToggle` own the class.

This keeps admin-only `ThemeProvider` while **guaranteeing** client routes never see `html.dark` after navigation from admin.

### Verification (mandatory manual check)

1. Open an admin page, switch to **dark**.
2. Navigate to `/` (or any non-admin URL).
3. Assert: `document.documentElement.classList.contains('dark')` is **false** (or client subtree is otherwise provably light per implementation).
4. Navigate back to `/admin`; theme toggle still works and dark can be re-applied.

---

## Phase 1 — Route isolation: `app/(client)` route group

### Goal

Hard filesystem boundary: all non-admin pages live under `app/(client)/**` so they inherit client layout + tokens + fonts.

### Rule (not a list)

**Client-branded = everything under `app/` except:**

- `app/admin/**` (admin)
- `app/api/**` (non-visual API routes)

### What does **not** move (explicit exclusions)

Unless a later decision says otherwise, these stay at their current locations:

- `app/layout.tsx` (root)
- `app/globals.css`
- Root-level **`error.tsx`**, **`global-error.tsx`**, **`not-found.tsx`**, **`loading.tsx`**, **`favicon.ico`**, etc.

**`app/not-found.tsx` (global):** decide explicitly for ship:

- **Neutral** — minimal styling, no `Client*` dependency (simplest; avoids importing client-only layout from a root special file), **or**
- **Client-branded** — wrap content in the same visual language (may require duplicating a slim header or linking to client tokens only via globals), **or**
- **Split** — only if product wants different not-found for admin vs client (usually unnecessary).

Record the chosen option in the PR / commit message when implementing.

### Moves (filesystem only; URLs unchanged)

Move these route segments only:

- `app/page.tsx` → `app/(client)/page.tsx`
- `app/apply/` → `app/(client)/apply/`
- `app/portal/` → `app/(client)/portal/`
- `app/sign-in/` → `app/(client)/sign-in/`
- `app/sign-up/` → `app/(client)/sign-up/`

### Mandatory checks

- **No `href="/..."` changes** (public URLs must remain stable).
- **No stale filesystem imports**: avoid importing pages/components via old `app/...` paths; prefer `@/…` aliases.
- **No `Link` / dynamic imports** pointing at removed filesystem paths.
- **Confirm segment shape**: each segment is moved as a **directory** (or file) matching the repo’s actual structure.

---

## Phase 2 — Client root layout: fonts + base typography + light-only scope

### Add `app/(client)/layout.tsx`

Responsibilities:

- Load **Inter** → `--font-body`
- Load **Noto Serif** (600) → `--font-display`
- Keep **mono** as the existing global `--font-code` (no change unless later desired)
- Wrap children in a single root container:
  - `className="theme-client text-[18px] leading-[1.6]"`
  - `data-ui="client"` (for deterministic checks + future targeting)

### Class name consistency (trivial merge bug prevention)

The **layout `className` string** must match the **CSS selector** in `app/globals.css`:

- Layout: `className="theme-client …"`
- CSS: `.theme-client { … }` (leading dot in the stylesheet only)

### Heading typography centralization

Ensure client headings consistently use the display font without per-page drift:

- Prefer rules **scoped under** `.theme-client` in `app/globals.css` for `h1–h4` / `.font-heading`, or a documented client-only utility.

### Theme toggle removal (client)

Remove/disable `ThemeToggle` usage under client routes (notably `/portal/**` today).

---

## Phase 3 — Scoped tokens: `.theme-client` in `app/globals.css`

### Goal

Client pages inherit brand colors/radii via shadcn CSS variables without changing admin `:root`.

### Requirements

- Add `.theme-client { … }` overrides for the **minimum required shadcn variable set** (see design spec).
- Add `color-scheme: light;` inside `.theme-client`.

### Error semantics (explicit)

- **`--error` (client semantic error / inline validation):** `#ff6262` (guideline)
- **`--destructive` (destructive actions/buttons):** `#ef4444` with hover `#dc2626`

Consumption:

- `ClientField` uses **`--error`** for validation + inline error text
- `ClientButton` `destructive` uses **`--destructive`**

### Wiring `--error` (not shadcn-default)

Tailwind v4 `@theme` / shadcn defaults do not define `--error` until you add it. Pick **one** approach and document it in the PR:

- **Option A — Theme color:** extend `@theme inline` in `app/globals.css` with something like `--color-error: var(--error)` so utilities like `text-error` / `border-error` exist, **or**
- **Option B — Arbitrary CSS:** in `ClientField`, use `text-[color:var(--error)]` / `border-[color:var(--error)]` (no new theme key).

Either way, **`ClientField` must not misuse `text-destructive`** for brand semantic errors if destructive red must stay button-specific.

---

## Phase 4 — Mandatory client wrappers (`components/client/**`)

### Required wrappers

- `ClientButton` — brand geometry + variants (yellow/blue/white secondary/destructive)
- `ClientNavLink` — 3px yellow indicator on hover/active
- `ClientSurface` / `ClientHeroPanel` — cut-corner motif presets
- `ClientCard` — brand shadows + hover elevation + 10–12px rounding
- `ClientField` / `ClientInput` — label/help/error + control radius + borders + focus ring using tokens (`--ring`, `--border`, `--input`, `--error`)

### Mandatory usage rule

Inside `app/(client)/**`:

- no direct `@/components/ui/button` except inside `ClientButton`
- no direct `@/components/ui/card` except inside `ClientCard`
- **all form control imports** (`input`, `textarea`, `select`, `label`, and any `@/components/ui/*` field primitives you use) go through **`ClientField` / `ClientInput`** only (except inside those wrapper files)
- avoid `buttonVariants` in pages; keep it inside wrappers

(ESLint enforcement is optional follow-up; initial pass can be grep + review.)

---

## Phase 5 — Rollout sequencing (reduce “half refit” weirdness)

### Order

1) **Layout chrome first** (headers/nav/sidebars/footers): `/`, `/apply/**`, `/portal/**`, `/sign-in`, `/sign-up`
2) **Page bodies** screen-by-screen:
   - `/`
   - `/apply/start` then remaining `/apply/**`
   - `/portal` hub, then `/portal/client-dashboard`, then `/portal/application-workspace`
   - `/sign-in`, `/sign-up`

---

## Phase 6 — Verification (deterministic + fast)

### CI minimum bar (shippable)

Before merge:

- `pnpm lint` (or repo-standard lint)
- `pnpm build` (or repo-standard build; matches CI if applicable)

### Route sanity

Confirm URLs still resolve:

- `/`, `/apply/start`, `/portal`, `/sign-in`, `/sign-up`, `/admin/*`

### Client checks

- Client root has `data-ui="client"`.
- Computed `color-scheme` is `light` within `.theme-client`.
- Computed CSS variables match expectations (examples):
  - `--foreground` resolves to `#012031`
  - `--primary` resolves to `#FCCD64`
- Fonts:
  - body uses Inter
  - headings use Noto Serif
- **Admin → client navigation:** after admin dark mode, `/` has **no** persisted `html.dark` (see Phase 0b verification).

### Admin checks

- Theme toggle still works.
- Visual parity with pre-change admin (spot-check light + dark).

### Repo checks (grep-able; align with Invariant C)

Under `app/(client)/**`, forbid direct imports except inside `components/client/**`:

- `@/components/ui/button`
- `@/components/ui/card`
- `@/components/ui/input`
- `@/components/ui/textarea`
- `@/components/ui/select`
- `@/components/ui/label`
- (add any other `@/components/ui/*` field primitives the app uses)

**Exception:** wrapper implementations under `components/client/**`.

---

## Rollback strategy

- Revert the route-group move + provider relocation + `ThemeClassSync` (if added) as a single coherent revert.
- Scoped `.theme-client` can be removed/disabled quickly without affecting admin `:root`.

---

## Open follow-ups (non-blocking)

- Optional ESLint rules to enforce wrapper-only imports under `app/(client)/**`.
- Decide whether any “internal” non-admin routes will exist later; if so, they must either live under `app/(client)` or be explicitly excluded with product approval.
