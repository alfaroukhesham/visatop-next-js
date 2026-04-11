# Design system

This file is the **source of truth** for **implementation tokens** (colors, typography, spacing, radii). Align with **`app/globals.css`** (shadcn CSS variables) and Tailwind `@theme inline`.

**Product behavior, flows, and screen-level UX** are defined in **[`PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md)** — read that before changing layouts, copy, or IA.

## Workflow (Stitch MCP)

1. Use Stitch MCP **`extract_design_context`** on a canonical screen when this file is missing or outdated.
2. Record **semantic** tokens here (e.g. “primary”, “muted”, “radius”) — not one-off hex values scattered in components.
3. Map Stitch output into **`app/globals.css`** `:root` / `.dark` variables so shadcn components inherit the theme.

## Palette (baseline)

| Token | Light | Notes |
|--------|--------|--------|
| background | `--background` | Page surface |
| foreground | `--foreground` | Primary text |
| primary | `--primary` | Primary actions |
| muted | `--muted` / `--muted-foreground` | Secondary UI |

Update the table after pulling from Stitch; keep names aligned with variables already defined in `app/globals.css`.

## Typography

- **Body:** Red Hat Text (`--font-body`, set in `app/layout.tsx`).
- **Headings:** Red Hat Display (`--font-display`).
- **Mono / data:** Red Hat Mono (`--font-code`).

## Spacing and radius

- Prefer Tailwind spacing scale and `--radius` / `--radius-*` from `globals.css`.
- Do not invent arbitrary pixel gaps for repeated patterns; extend the scale in theme if needed.

## Layout

- App shell: full-height flex column (`min-h-full` on `body`).
- Content max-width and section spacing: document key breakpoints here when designs define them.
