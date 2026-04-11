# Unified Hybrid Portal — product requirements

**Source of truth** for product intent, user flows, screen behavior, and design direction. When adding or changing UI, data models, or copy, align with this document. Implementation tokens live in [`DESIGN.md`](DESIGN.md) and [`app/globals.css`](app/globals.css).

---

## Product overview

**The pitch:** An enterprise-grade, role-aware portal for streamlining tourist visa applications. It combines user application tracking and back-office administrative operations under a single, unified interface governed by the Red Hat Design System (conceptually — sharp hierarchy, high contrast).

**For:** Tourists seeking fast visa processing and immigration agents managing high-volume document pipelines.

**Device:** Desktop-first.

**Design direction:** Balanced, unified architecture emphasizing clarity, structural hierarchy, and data density. High contrast, sharp corners, strictly left-aligned primary actions.

**Inspired by:** Red Hat Customer Portal, OpenShift Console.

---

## Screens (IA)

| Screen | Route (app) | Purpose |
|--------|-------------|---------|
| Client dashboard | `/portal/client-dashboard` | Visa catalog and active application tracker |
| Application workspace | `/portal/application-workspace` | Document upload, OCR extraction review, fee payment |
| Admin operations | `/portal/admin-operations` | Centralized queue for agent document verification |
| Admin automations | `/portal/admin-automations` | Workflow builder for OCR rules and auto-approvals |

---

## Key flows

### Visa application (client)

1. User is on **Client dashboard** → sees available visa destinations.
2. User clicks **Start application** → navigates to **Application workspace**.
3. Uploads passport → OCR auto-extracts details → user pays (e.g. Stripe) → application status updates to **Processing**.

### Agent verification (admin)

1. Admin is on **Admin operations** → sees pending verifications.
2. Admin opens a row → side panel with extracted data vs. original image.
3. **Approve** → application advances to **Awaiting Embassy** (or equivalent next state).

---

## Design system — color

### Light mode (default)

| Role | Hex | Usage |
|------|-----|--------|
| Primary | `#EE0000` | Brand red — main CTA, active states |
| Background | `#F2F2F2` | App background |
| Surface | `#FFFFFF` | Cards, panels, modals |
| Text | `#151515` | Primary body text, headings |
| Muted | `#6A6E73` | Secondary text, borders, inactive tabs |
| Accent (link) | `#0066CC` | Links, secondary actions |
| Success | `#3E8635` | Status badges, completion states |

Borders: `1px solid #D2D2D2` for separation (no drop shadows per spec). Stitch exports sometimes use `#e40c0c` for primary — treat **`#EE0000` as canonical PRD red** when reconciling with code.

### Dark mode

| Role | Hex |
|------|-----|
| Primary | `#EE0000` |
| Background | `#151515` |
| Surface | `#212427` |
| Text | `#FFFFFF` |
| Muted | `#B8BBBE` |
| Accent (link) | `#73BCF7` |
| Success | `#3E8635` |

Borders: `1px solid #4D5258` (or equivalent token).

### CSS variables (reference)

```css
:root {
  --color-primary: #EE0000;
  --color-background: #F2F2F2;
  --color-surface: #FFFFFF;
  --color-text: #151515;
  --color-muted: #6A6E73;
  --color-link: #0066CC;
  --font-display: 'Red Hat Display', sans-serif;
  --font-body: 'Red Hat Text', sans-serif;
  --font-mono: 'Red Hat Mono', monospace;
  --radius: 0px;
  --spacing: 16px;
}

[data-theme="dark"] {
  --color-background: #151515;
  --color-surface: #212427;
  --color-text: #FFFFFF;
  --color-muted: #B8BBBE;
  --color-link: #73BCF7;
}
```

Map these to shadcn tokens in `globals.css` when evolving the theme.

---

## Typography

- **Headings:** Red Hat Display, 700, 24–32px (PRD).
- **Body:** Red Hat Text, 400, 16px (max ~120 chars per line where possible).
- **Small:** Red Hat Text, 400, 14px.
- **Data / code:** Red Hat Mono, 400, 14px.
- **Buttons:** Red Hat Text, 600, 16px.

**Style notes:** Sharp corners (`0px` radius). High contrast. One primary red button per view where possible. Buttons strictly left-aligned.

---

## Screen specifications

### Client dashboard

- **Purpose:** Portal entry — active applications and new visa options.
- **Layout:** Global top nav, left sidebar (account / applications / help), main content: active applications banner, grid of destination cards.
- **Key elements:** 64px header `#151515`, light/dark toggle, avatar. Active tracker: surface background, `#D2D2D2` border, success badge `#3E8635`. Catalog: left-aligned titles, `#0066CC` “View Requirements” links.
- **Primary CTA:** “Start Application” — primary red.
- **Cards:** ~300px width feel, `1px` border, hover: strong bottom border (`#151515` light / `#FFFFFF` dark).
- **Responsive:** Desktop 250px sidebar, 3-col grid; tablet collapsed sidebar, 2-col; mobile hamburger, single column.

### Application workspace

- **Purpose:** Upload, OCR verification, checkout.
- **Layout:** Split: left form/upload, right extracted data (sticky on desktop).
- **Upload:** ~200px dropzone height, dashed `2px #6A6E73`.
- **Preview:** Red Hat Mono for extracted fields; labels 12px muted, values 14px text color.
- **Payment:** Inline payment UI at bottom of left column (e.g. Stripe-shaped).
- **CTA:** “Pay & Submit” — primary red, left-aligned.
- **Responsive:** Desktop 60/40; tablet stack; mobile dropzone full width, preview in accordion if needed.

### Admin operations

- **Purpose:** High-volume verification queue.
- **Layout:** Global top nav + full-width table.
- **Table:** ID, Applicant, Destination, Status, Date; filter bar above; row actions (e.g. overflow menu).
- **Status badges:** Flat surface, left border 4px color-coded (pending / processing / awaiting).
- **Row:** ~48px height, muted bottom border; hover: background lift.
- **Drawer:** ~400px review panel from row selection.
- **Responsive:** Desktop full table; tablet hide date; mobile card list.

### Admin automations

- **Purpose:** OCR rules and auto-approval thresholds.
- **Layout:** Split: left rule list, right rule editor (IF/THEN, confidence slider).
- **CTA:** “Save Rule” — primary red.
- **Responsive:** Desktop 30/70; tablet stack; mobile “desktop only” acceptable per original spec.

---

## Build / stack notes (reference)

- Original Stitch output: HTML + Tailwind v3 patterns.
- App implementation: Next.js App Router, shadcn/ui, Tailwind v4 — preserve **semantics** (roles, hierarchy, states) even if class names differ.

**Engineering conventions** (DB, RLS, payments, phases): [`docs/IMPLEMENTATION_REFERENCE.md`](docs/IMPLEMENTATION_REFERENCE.md).

---

## Changelog

- Migrated from in-app `/portal/prd` page to this file as the canonical PRD for agents and humans.
