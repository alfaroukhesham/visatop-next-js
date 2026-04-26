# Client brand theme (Visatop) — design spec

Date: 2026-04-20  
Scope: **All non-admin pages** in this repo (client-facing) adopt the company’s brand guidelines (from `website-brand-guidlines-summary.md`). Admin keeps the current design system and light/dark behavior unchanged.

Implementation plan: [`2026-04-22-client-brand-theme-implementation-plan.md`](../plans/2026-04-22-client-brand-theme-implementation-plan.md)

## 1) Goal and non-goals

### Goal
- Make **every non-admin route** render with a **Visatop client brand** consistent with the company’s marketing site:
  - Fonts: **Inter** (body/UI), **Noto Serif** (headings/emphasis)
  - Colors: Ink `#012031`, Blue `#224D64` (+ supporting blues), Yellow CTA `#FCCD64` (+ hover `#FFE19F`), surfaces including `#F2F9FC`
  - Radii language: controls `5px`, cards `10–12px`, plus selective “cut-corner” motif
  - Interaction patterns: yellow underline indicator in nav; fast hover transitions; card shadow/elevation patterns
- Keep **admin** visually and behaviorally unchanged (including dark mode).
- Prioritize **sharing generic elements** (shadcn/ui primitives, utilities, layout helpers, logic) between admin and client, while allowing a full client refit.

### Non-goals
- Rebuilding or importing the external marketing site into this repo.
- Implementing a dark-mode palette for client pages (client is **light-only**).
- Refactoring unrelated business logic, data access, RLS, or payments.

## 2) Current state (observed)

### Design system
- Global tokens are defined in `app/globals.css` as shadcn CSS variables (`:root` for light, `.dark` for dark).
- Global fonts are configured in `app/layout.tsx` using Red Hat fonts mapped to CSS vars:
  - `--font-body`, `--font-display`, `--font-code`
- The root layout wraps content with a `ThemeProvider` and exposes a `ThemeToggle` globally.

### Routes and layouts
- Admin is under `app/admin/**` (admin protected layout at `app/admin/(protected)/layout.tsx`).
- Client-facing areas include:
  - `/` (`app/page.tsx`)
  - `/apply/**` (`app/apply/**`)
  - `/portal/**` (`app/portal/**`) — currently client-only content
  - `/sign-in`, `/sign-up`

## 3) Requirements (functional + UX)

### Functional requirements
- **Isolation**: client branding must not affect admin routes.
- **Consistency**: all client pages use one cohesive theme and type scale.
- **Light-only client**: client pages should not render in dark mode (even if the user previously toggled dark theme for admin).

### Route-scoping rule (not a list)
- **Client-branded = everything under `app/` except `app/admin/**`**, excluding `app/api/**` (API routes are non-visual).
- No other exceptions are expected for MVP. If we add internal tools later, they must live under `app/admin/**` or a separate explicit route group.

### UX requirements (brand-driven)
- Client pages should feel visually continuous with the company marketing funnel:
  - Ink-forward text, yellow CTAs, blue surfaces and accents.
  - Distinctive “cut-corner” motif for hero/highlight containers (not everywhere).
  - Card/menu shadows that match the guideline style.
  - Button geometry and typography consistent with guideline sizing (not purely token-driven).

## 4) Architecture decision: “Two skins, shared primitives”

We implement **Approach 1**: treat this repo as two “skins” over mostly shared primitives.

### Admin skin (unchanged)
- Uses existing global theme tokens (`:root` + `.dark`) and existing Red Hat fonts.
- Keeps ThemeProvider + dark mode toggle behavior.

### Client skin (new)
- Applies a **scoped client theme** (CSS variable overrides) and **scoped client fonts** to **all non-admin pages**.
- Client remains **light-only**.

### Sharing strategy
- **Shared**: shadcn/ui primitives (`Button`, `Card`, `Input`, etc.), Tailwind utilities, `cn`, validation/UI logic, route handlers, server actions, business logic.
- **Client-only wrappers**: thin “brand pattern” components that compose shared primitives where tokens are insufficient (buttons, nav underline, cut-corner panels, card shadow rules).

## 5) Route isolation design (hard boundary)

### Decision
All non-admin routes should inherit a **ClientRootLayout**, while all admin routes should continue inheriting the existing Admin/Default theme.

### Mechanism
Use a route group to scope client layout:
- Create `app/(client)/layout.tsx` as the root layout for client pages.
- Move all client routes under `app/(client)/...`:
  - `app/(client)/page.tsx`
  - `app/(client)/apply/**`
  - `app/(client)/portal/**`
  - `app/(client)/sign-in/**`
  - `app/(client)/sign-up/**`
- Leave `app/admin/**` outside the group.

### Guarantee
Admin pages cannot pick up client tokens/fonts because they are not rendered under the client layout subtree.

## 6) Client theme design (tokens)

### Naming convention
- Use brand-agnostic identifiers:
  - CSS scope class: `.theme-client`
  - Component wrappers: `ClientButton`, `ClientNavLink`, etc.

### Token mapping approach
We do not hardcode brand hex values throughout components. Instead we:
- Override the same shadcn variables already used across pages:
  - `--background`, `--foreground`, `--card`, `--primary`, `--link`, `--border`, etc.
- Let existing Tailwind semantic utilities (`bg-background`, `text-foreground`, `bg-primary`, `text-link`, etc.) automatically adopt the brand.

### Brand inputs (from `website-brand-guidlines-summary.md`)
- Ink: `#012031`
- White: `#FFFFFF`
- Primary blue: `#224D64`
- Blue light: `#7095A7`
- Blue light (alt): `#375C6F`
- Surface (blue lighten): `#F2F9FC`
- Accent (blue lighten 2): `#92C0D7`
- Primary yellow (CTA): `#FCCD64`
- Yellow hover: `#FFE19F`
- Yellow dark (links/hover accent): `#CE8E00`
- Neutrals: `#E7E7E7`, `#E1E1E1`, `#C4C4C4`
- **Brand error (semantic)**: `#ff6262` (guideline token)
- **Destructive button red (UI)**: `#ef4444` → hover `#dc2626` (existing app behavior)
- Radii: controls `5px`, cards `10–12px`

### Client token set (light only)
Define client overrides in `app/globals.css`:
- `.theme-client { ... }` with:
  - **Minimum required shadcn variable set (override all of these for consistency)**:
    - `--background`: `#ffffff`
    - `--foreground`: `#012031`
    - `--card`: `#ffffff` *(intent: cards are white by default; “surface blue” is expressed via `--muted`/section wrappers)*
    - `--card-foreground`: `#012031`
    - `--popover`: `#ffffff`
    - `--popover-foreground`: `#012031`
    - `--primary`: `#fccd64`
    - `--primary-foreground`: `#012031`
    - `--secondary`: `#224d64`
    - `--secondary-foreground`: `#ffffff`
    - `--muted`: `#f2f9fc`
    - `--muted-foreground`: `#375c6f`
    - `--accent`: `#f2f9fc`
    - `--accent-foreground`: `#224d64`
    - `--border`: `#e7e7e7`
    - `--input`: `#e1e1e1`
    - `--ring`: `#92c0d7`
    - `--link`: `#ce8e00`
    - `--destructive`: `#ef4444` *(destructive button token)*  
    - `--destructive-foreground`: `#ffffff`
    - `--radius`: `5px`
  - **Additional client-only semantic token (optional)**:
    - `--error`: `#ff6262` *(brand semantic error; used for inline validation states where we don't want “button red” semantics)*

### Radii beyond `--radius`
To support “cards/menus/media 10–12px” without breaking the shared system:
- Use component-level decisions for card-ish wrappers (`ClientCard`, `ClientMenuSurface`) that apply:
  - `rounded-lg` / `rounded-xl` (depending on how Tailwind maps to radius vars)
  - or explicit `rounded-[10px]` / `rounded-[12px]` where needed

## 7) Client typography (scoped fonts)

### Decision
Client pages use:
- **Inter** for body/UI (`--font-body`)
- **Noto Serif** for headings/emphasis (`--font-display`)

### Mechanism
In `app/(client)/layout.tsx`, load Google fonts with `next/font/google` and apply the `variable` classes at the client root wrapper so only client subtree receives these font variables.

### Body text size
Brand guideline indicates body is **18px** with `line-height: 1.6`.

Decision (explicit):
- **Client subtree default typography is 18px / 1.6**, scoped to the client layout wrapper (so admin remains unchanged).
- Implement by applying `text-[18px] leading-[1.6]` on the client root wrapper (or equivalent CSS on `.theme-client`), not on global `body`.

Heading scale (client):
- Keep a simple, explicit scale aligned with the guideline:
  - H1: 56px desktop / 36px mobile (Noto Serif, 600)
  - H2: 36px (Noto Serif, 600)
  - H3: 20px (Inter or Noto Serif depending on section; default to Noto Serif for emphasis)

## 8) Client-only brand patterns (wrappers)

Tokens alone will not produce a full “C” refit. The following wrappers provide brand-specific geometry and interaction patterns while composing shared primitives.

### `ClientButton`
Purpose: match brand button sizing + typography while reusing shadcn `Button` styles.

Behavior:
- Primary (yellow) CTA:
  - height `46px`, min-width `148px`, radius `5px`
  - uppercase Inter, ~16px, fast hover
  - hover uses `#FFE19F` (via `--primary` + custom hover token or class)
- Blue variant:
  - min-width `200px`, height `50px`, text white, hover blue light
- Secondary (white) variant:
  - white background; hover flips to blue with white text

Implementation note:
- This is intentionally **more opinionated** than shadcn defaults; use it for high-importance CTAs in client flows.

### `ClientNavLink` (underline indicator)
Purpose: replicate the guideline’s 3px yellow underline bar on hover/active.

Behavior:
- Normal: ink/blue text, no underline
- Hover/active: shows a 3px bar using `--primary` or a dedicated `--nav-indicator`

### `ClientHeroPanel` / `ClientSurface`
Purpose: provide the “cut-corner” signature motif for major sections only.

Behavior:
- Applies asymmetric border-radius presets like:
  - `100px 0 100px 0`
  - `40px 0 40px 0`
- Used selectively:
  - hero blocks
  - highlight blocks
  - major section containers

### `ClientCard`
Purpose: brand card elevation and hover.

Behavior:
- Default: `0 4px 20px rgba(0,0,0,0.08)`
- Hover: `0 10px 30px rgba(0,0,0,0.12)`
- Rounded 10–12px (where appropriate)

## 9) Dark mode behavior

### Decision
- Client pages are **light-only**.
- Admin keeps existing light/dark and the theme toggle.

### Mechanism (client)
Invariant (explicit):
- Inside `.theme-client`, the `.dark` class must never be present on any ancestor element.

Enforcement (single decision):
- **Move the global `ThemeProvider` + `ThemeToggle` out of `app/layout.tsx` and into an admin-only layout subtree** (e.g. `app/admin/layout.tsx` or `app/admin/(protected)/layout.tsx`).
- **Client layout does not mount `ThemeProvider` and does not render `ThemeToggle`.**
- Add `color-scheme: light;` to `.theme-client` so UA-rendered controls (inputs/selects) stay light even if the OS prefers dark.

**Persisted `html.dark` (admin → client):** With `next-themes` `attribute="class"`, a user can leave `dark` on `<html>` after visiting admin. A small **root-mounted client sync** (e.g. `ThemeClassSync`) must strip `dark` from `document.documentElement` on non-admin routes while leaving `/admin/**` unchanged. See the implementation plan **Phase 0b**.

Admin retains the existing `ThemeProvider` + `ThemeToggle` behavior under `app/admin/**`.

## 10) Migration plan (design-level steps)

1) **Create client route group**: `app/(client)/layout.tsx`.
2) **Move non-admin routes** under `app/(client)` so they inherit client layout.
3) **Client layout**:
   - applies `.theme-client` wrapper
   - loads Inter + Noto Serif and sets font variables
   - ensures light-only rendering
4) **Client theme overrides**: add `.theme-client { ... }` to `app/globals.css`.
5) **Introduce wrappers**: add `ClientButton`, `ClientNavLink`, `ClientHeroPanel`, `ClientCard`.
6) **Refit key pages** (highest traffic/brand impact first):
   - `/` home
   - `/apply/start` and apply flow pages
   - `/portal/client-dashboard`
   - `/portal/application-workspace`
   - auth pages `/sign-in`, `/sign-up`

## 11) Acceptance criteria

### Visual
- All non-admin routes:
  - use Inter body and Noto Serif headings
  - use Ink/Yellow/Blue palette from the guideline
  - controls have 5px rounding; cards use 10–12px rounding where applicable
  - nav underline indicator matches guideline behavior
  - key surfaces/hero blocks use cut-corner motif selectively
- Admin routes:
  - unchanged visuals compared to today (including dark mode)

### Behavioral
- Client pages do not switch to dark mode.
- Shared components continue to function (forms, validation, document upload/extraction flows) without behavioral regressions.

### Fast verification checks (testable)
- **Fonts**: On a client page (e.g. `/apply/start`), computed font family for body uses Inter and `h1/h2` uses Noto Serif.
- **Theme tokens**: On a client page, computed `--foreground` equals `#012031` and `--primary` equals `#FCCD64`.
- **No dark**: On any client page, there is no `.dark` class in any ancestor of the client root wrapper.
- **Admin unchanged**: On an admin page (e.g. `/admin/(protected)`), dark mode toggle still works and the admin palette matches current `:root`/`.dark`.
- **Route sanity**: URLs remain identical before/after route-group filesystem move (`/apply/*`, `/portal/*`, `/sign-in`, `/sign-up`, `/`).

## 12) Risks and mitigations

### CSS specificity conflicts
- Risk: introducing scoped overrides might conflict with existing global styles.
- Mitigation: scope all client overrides under `.theme-client` and avoid changing `:root` defaults.

### Route move churn
- Risk: moving routes under `app/(client)` changes file paths and may require updating imports/links/tests.
- Mitigation: keep route URLs identical; only filesystem structure changes.

Concrete mitigations:
- Prefer existing path aliases (`@/…`) and avoid importing via `app/...` relative paths.
- After moving folders, run a repo-wide search for stale import paths that referenced the old filesystem location and update them.
- Do **not** change any `href="/..."` routes; URLs must remain stable.

### Partial refit looks inconsistent
- Risk: token re-skin is immediate but deeper patterns lag.
- Mitigation: ship wrappers early and apply them to the highest-visibility CTAs and navigation first.

---

## Open questions (resolved)
- Client-facing scope: **all non-admin pages** — resolved.
- Client dark mode: **disabled (light-only)** — resolved.
- Naming: **generic** (`theme-client`, `Client*`) — resolved.

