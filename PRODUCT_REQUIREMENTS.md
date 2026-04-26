# Unified Hybrid Portal — product requirements

**Source of truth** for product intent, user flows, screen behavior, and **admin-facing** layout and visual direction. When adding or changing UI, data models, or copy, align with this document. **Implementation tokens** live in [`DESIGN.md`](DESIGN.md) and [`app/globals.css`](app/globals.css).

**Two surfaces in one app:**

| Surface | Who | Visual / UX source |
|--------|-----|-------------------|
| **Client** (`app/(client)/**`) | People applying for a visa (e.g. UAE) | **Visatop marketing brand** — [`website-brand-guidlines-summary.md`](website-brand-guidlines-summary.md) and [`docs/superpowers/specs/2026-04-20-client-brand-theme-design.md`](docs/superpowers/specs/2026-04-20-client-brand-theme-design.md). Application flow should feel **professional, easy, and modern**, with stepwise “apply online” clarity similar in spirit to consumer visa portals (e.g. [Dubai Visa Online](https://dubaivisa.com/)). |
| **Admin** (`app/admin/**`) | Internal ops staff running the site | **This document** — Red Hat–inspired hierarchy, palette below, desktop-first density. |

Client routes do **not** use the Red Hat palette or admin dark-mode behavior; admin routes do **not** pick up the Visatop client theme.

---

## Product overview

**The pitch:** An enterprise-grade portal for streamlining tourist visa applications: applicants track and complete their visa online; **admins** run verification, catalog, and operations in a separate, tool-dense UI.

**For:** **Clients** (visa applicants) and **admins** (ops staff). No additional product personas beyond these two.

**Device:** Desktop-first for both; client flows should remain usable on common mobile widths for apply/checkout where applicants start on a phone.

**Admin design direction:** Clarity, structural hierarchy, and data density. High contrast, sharp corners (`--radius` baseline for admin skin), strictly left-aligned primary actions where the PRD specifies it.

**Admin inspired by:** Red Hat Customer Portal, OpenShift Console.

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

## Client UI — design (Visatop)

Do **not** use the color/typography tables in the next section for client pages. Client implementation uses **scoped** `.theme-client` variables, **Inter** + **Noto Serif**, and the hex/radius/shadow language in [`website-brand-guidlines-summary.md`](website-brand-guidlines-summary.md). Client is **light-only** in current scope.

Screen subsections below (“Client dashboard”, “Application workspace”) describe **IA, layout, and behavior**; replace any legacy “primary red” / Red Hat color callouts with **client semantic tokens** (`bg-primary`, `text-foreground`, etc.) per the client brand spec.

---

## Admin / operator UI — color

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

### Admin / operator UI

- **Headings:** Red Hat Display, 700, 24–32px (PRD).
- **Body:** Red Hat Text, 400, 16px (max ~120 chars per line where possible).
- **Small:** Red Hat Text, 400, 14px.
- **Data / code:** Red Hat Mono, 400, 14px.
- **Buttons:** Red Hat Text, 600, 16px.

**Admin style notes:** Sharp corners (`0px` radius on admin skin). High contrast. One primary action per view where possible. Buttons strictly left-aligned where specified below.

### Client UI (Visatop)

- **Body / UI:** Inter — baseline **18px**, relaxed line height (see `app/(client)/layout.tsx` and client theme spec).
- **Headings / emphasis:** Noto Serif, weight **600**, scale per [`website-brand-guidlines-summary.md`](website-brand-guidlines-summary.md).

---

## Screen specifications

### Client dashboard

- **Purpose:** Portal entry — active applications and new visa options.
- **Layout:** Global top nav, left sidebar (account / applications / help), main content: active applications banner, grid of destination cards.
- **Key elements:** Clear header bar with nav and account affordances (use **client** `foreground` / `background` tokens, not admin hex). Active tracker: card surface, **border** token, success state via **success** token. Catalog: left-aligned titles; secondary links use **`text-link`** (gold on client skin).
- **Primary CTA:** “Start application” — **`bg-primary`** / **`text-primary-foreground`** (yellow CTA on client theme).
- **Cards:** ~300px width feel, border from tokens; hover elevation/shadow per brand guidelines where implemented.
- **Responsive:** Desktop 250px sidebar, 3-col grid; tablet collapsed sidebar, 2-col; mobile hamburger, single column.

### Application workspace

- **Purpose:** Upload, OCR verification, checkout.
- **Layout:** Split: left form/upload, right extracted data (sticky on desktop).
- **Upload:** ~200px dropzone height, dashed border using **muted** border tone.
- **Preview:** **Mono** font for extracted fields where data alignment matters; labels small **muted-foreground**, values **foreground**.
- **Payment:** Inline payment UI at bottom of left column (provider-specific).
- **CTA:** “Pay & submit” — **primary** client token, left-aligned.
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

**Pricing & catalog data:** **Reference costs** and **service/catalog details** are maintained by **admins** via **CSV/Excel import** (validated, audited) and admin UI — **not** by **web scraping** third-party sites. See [`docs/IMPLEMENTATION_REFERENCE.md`](docs/IMPLEMENTATION_REFERENCE.md) §2 and [`docs/plans/2026-04-07-visa-platform-design.md`](docs/plans/2026-04-07-visa-platform-design.md).

---

## Changelog

- Migrated from in-app `/portal/prd` page to this file as the canonical PRD for agents and humans.
- Documented **admin CSV/XLSX** as the source for **reference pricing and catalog details**; **scraping-based** price retrieval is **out of scope**.
- Clarified **client vs admin** design sources: Visatop client brand + online-apply UX goals vs Red Hat–style admin palette; client screen specs refer to semantic tokens instead of admin-only hex.
