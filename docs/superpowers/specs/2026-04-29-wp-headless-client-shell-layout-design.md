# WP headless client shell layout (header/footer) — design

Date: 2026-04-29  
Scope: Next.js client shell (`app/(client)`) integrates WordPress-driven header/footer via REST layout endpoint.

## Goals

- Use WordPress as **source of truth** for:
  - **Header** navigation/menu structure
  - **Footer** navigation/menu structure
  - Curated **CSS assets** for the WP shell
- Keep existing app navigation as a **secondary bar** (e.g. `ClientAppHeader`) rendered **below** the WP header.
- Replace the current `ClientShellFooter` with a WP-driven footer.
- Make layout failures **non-fatal** (WP can be down; the app must still render).
- Ensure internal navigation respects Next.js `basePath` (currently `/visa-processing` and intended for production).

## Non-goals

- Embedding WP-rendered HTML by default (`include=html`) is out of scope. (May be added later as an escape hatch.)
- Implementing any scraping/syncing. All data comes from the WP REST endpoint at request time / ISR.

## Data contract

Endpoint:

- `GET /wp-json/headless/v1/layout?include=menus,css[&lang=<locale>]`

Expected payload (conceptual):

- `menus.header_menu`: tree of items with `children`
- `menus.footer_menu`: tree of items with `children`
- `css`: array of stylesheet assets: `{ id, url }`

Notes:

- Missing fields are tolerated (partial responses still render).
- Network failures time out quickly and fall back to local shell components.

## Rendering composition

### Where the WP shell mounts

- Apply WP header/footer to **all** routes under `app/(client)`.

### Client shell stacking order

Top → bottom:

1. **WP Header** (primary global shell)
2. Route-group header(s) such as **`ClientAppHeader`** (secondary app navigation, route-specific)
3. Page content
4. **WP Footer** (primary global footer)

### HTML strategy

- **Data-first render**:
  - The WP header/footer are rendered as **local React components** using `menus.*`.
  - The WP endpoint provides **CSS assets** to align branding and styling.
- No WP HTML embedding by default (avoid `dangerouslySetInnerHTML`).

## Fetching, caching, and freshness

- Fetch layout data **server-side** from `app/(client)/layout.tsx` (RSC).
- Use ISR (`fetch(..., { next: { revalidate: 60 } })`) so WP updates appear without redeploy.
- Centralize fetch logic in one server utility, responsible for:
  - Building query params (`include=menus,css`, optional `lang`)
  - Timeouts + error handling
  - Returning a safe, normalized shape for the renderer

## Link normalization (basePath + external links)

### Requirement

The Next app uses `basePath: "/visa-processing"`. WP menu links must be normalized so:

- Internal links to the app work under `/visa-processing` (dev and prod)
- External links remain external

### Rules

For each WP menu item `url`:

- If it is a relative path that starts with `/visa-processing` (e.g. `/visa-processing/apply/start`), strip the `/visa-processing` prefix and treat as an **internal app route** (render with `next/link` using `/apply/start` so Next applies `basePath`).
- If it is an absolute URL whose pathname starts with `/visa-processing` (e.g. `https://visatop.com/visa-processing/...`), strip origin + `/visa-processing` prefix and treat as internal.
- If it is same-origin but points outside the app mount (e.g. `https://visatop.com/blog/...`), treat as **external** (regular `<a>`).
- For all other origins, treat as **external**.

Open questions (tracked):

- Whether WP will sometimes emit relative URLs that should route into the app but do **not** include `/visa-processing`; if yes, define a mapping table or an explicit “app route” flag in WP menu item metadata.

## CSS asset safety (allowlist + dedupe)

### Requirement

WP provides `css[]` URLs, but we must never blindly inject arbitrary remote styles.

### Rules

- Only allow `https:` URLs.
- Only allow a configurable host allowlist (env-driven), e.g. `WP_PUBLIC_ASSET_HOSTS=www.visatop.com,wp.visatop.com,cdn.example.com`
- Dedupe URLs by normalized string.
- Render as `<link rel="stylesheet" href="...">` in the client shell (server-rendered).

## Failure handling / fallback

Failures must not break page rendering:

- If the WP layout fetch fails (timeout/network/5xx/invalid JSON):
  - Render a minimal local header (brand + a couple of key links) and minimal footer
  - Do **not** block rendering of children
- If menus are missing but CSS is present:
  - Render local header/footer but still inject allowed CSS assets

## Accessibility & semantics

- Header rendered as `<header>` with a `<nav aria-label="Primary">`
- Footer rendered as `<footer>` with appropriate nav labels (e.g. `"Footer"`)
- Menu trees render nested lists; keyboard navigation works by default (links).

## Testing strategy

- Unit tests for:
  - Link normalization rules (absolute/relative, same-origin, basePath stripping)
  - CSS allowlist logic (protocol/host/dedupe)
- Integration tests (optional):
  - Layout fetch fallback behavior (simulate failure and confirm local shell renders)

## Rollout / migration

- Introduce WP shell components behind a feature flag if needed (env toggle), but default-on is acceptable for local dev once endpoint is reachable.
- Replace `ClientShellFooter` usage in `app/(client)/layout.tsx` with WP footer.

