# Phase C — Shell, resume, SEO

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Prerequisite:** Phase B complete and Cursor-reviewed.  
> **Executor:** OpenCode. **Reviewer:** Cursor.  
> **Index:** [2026-09-05-tourist-journey-README.md](./2026-09-05-tourist-journey-README.md)  
> **Rule:** `.cursor/rules/visa-admin-and-customer-together.mdc`

**Goal:** Finish tourist chrome (hide Featured/Khaleej, one Apply/Track CTA from WP, same-tab iframe links), locale plumbing (`?locale=` + cookie + lookalike switcher; **string catalogs last**), phone country-code from **nationality.dialCode**, guest resume **modal** via `vt_resume` (no fingerprint) + signed email link + track Continue, apply-home H1/meta/blog from **Settings**. Admin UI stays English.

**Architecture:** Reuse `vt_resume` and HMAC from `lib/applications/guest-link-intent.ts`. Email token is `{ partyId, primaryApplicationId, exp }` signed with `GUEST_LINK_INTENT_SECRET` — not the cookie plaintext. GET `/apply/resume?t=` sets `vt_resume` and redirects. Draft TTL already admin (`draft_ttl_hours`). Track names already shipped in Phase A. WP header/footer stay the global chrome (`GET /wp-json/headless/v1/layout`); Next `ClientAppHeader` is auth-only. Locale list is **live Polylang**, not a hardcoded 10-language map.

**Tech Stack:** Existing apply layout, `WpShellFrame`, Settings/`platform_setting` (same pattern as draft TTL), Catalog nationality form/PATCH, Mailgun transactional kinds. i18n library TBD in Task 7 (must follow Polylang slugs from `pll/v1/languages` / layout `language.available`).

**Do not:**

- Hardcode a 9-country `DIAL_BY_ISO2` map. Dial lives on `nationality`.
- Hardcode apply-home title / H1 / blog hrefs in `page.tsx`.
- Put resume tokens or PII in localStorage.
- Regress Catalog list-then-edit or Document rules.
- Duplicate Apply / Track in the Next.js bar when the WP header already has those items.
- Invent a locale list in TS. Read Polylang (`GET https://visatop.com/wp-json/pll/v1/languages` or layout `language.available`).
- Re-open the 4-step rail / coach overlay / `HomeDemoVideo` work unless the user asks.

**Already shipped (do not redo):** `ApplyJourneyStepBar` is unused. `HomeDemoVideo` is gone. Guided visa choice is multi-question and absorbs nationality as step 1. Rail is four items (Visa → Documents → Payment → Status). Pay is gated on email + required uploads (Phase B) — not “empty docs still reach checkout.”

**Allowed in code (product chrome, not catalog):** hiding WP Featured / Khaleej time, removing iframe `target="_blank"`, dropping Next Apply/Track nav items.

---

## File map

| Area | Create | Modify |
|---|---|---|
| Chrome | — | `wp-shell-frame.tsx` (hide Featured/Khaleej; same-tab links), `client-app-header.tsx` (drop Apply/Track; keep Login/Account), `client-shell-footer.tsx` if it still duplicates Apply |
| Dial (admin + apply) | `drizzle/0027_nationality_dial_code.sql` | `visa.ts` nationality, `catalog-types.ts`, nationality form + PATCH, `get-catalog-entity.ts`, `applicant-review.tsx`, `phone-country-field.tsx` |
| Apply-home copy (admin) | `lib/apply/apply-home-copy.ts`, `components/admin/apply-home-seo-settings.tsx`, `components/admin/apply-blog-link-settings.tsx` | Settings page, `app/(client)/page.tsx`, `lib/seo/home-page-facts.ts`, `lib/seo/home-page-json-ld.ts` |
| Resume | `lib/applications/resume-email-link.ts`, `lib/applications/resume-hint.ts`, `app/api/applications/resume-hint/route.ts`, `app/(client)/apply/resume/page.tsx`, `components/apply/resume-banner.tsx` | create-draft route, track form, transactional email kinds |
| Track Continue | — | track-lookup API + form, signed-in list if needed |
| i18n | `lib/i18n/*` (TBD after Task 7 design) | `(client)/layout.tsx` pass `lang` into `fetchWpShellModel`; WP switcher; apply/track/auth copy |

---

### Task 1: Remaining chrome — Featured/Khaleej, one Apply/Track, same-tab WP links

Coach overlay, autoplay video, and the 4-step guided-choice flow are **already done**. Do not rewrite the rail.

**Files:**
- Modify: `components/client/wp-shell/wp-shell-frame.tsx`
- Modify: `components/client/client-app-header.tsx`
- Modify: `components/client/client-shell-footer.tsx` if it still links Apply
- Leave: `WpShellFallbackHeader` Apply/Portal links (WP-down only)

**1a — Hide Featured on / Khaleej time** in the injected WP header (`buildSrcDoc` styles). Match selectors already used in `WpShellFrame`:

```css
header#header .featured_on,
header#header .time_in_uae,
header#header .uae-time {
  display: none !important;
}
```

After hide, header height measurement must not still add `.featured_on` bottom (see `measureTargetHeight`).

**1b — One Apply / Track CTA (WP wins).** Live WP header menu already has those items (`/visa-processing` and `/visa-processing/apply/track`, translated per Polylang). Remove the Next.js duplicates:

- `ClientAppHeader` `NAV_BASE`: delete Apply and Track.
- Keep **Login / Register**, **Account**, **Sign out**, welcome name.
- Do not add a second language selector in this task (Task 7).

**1c — Same tab for iframe links.** Today `<base target="_blank">` plus a comment in `wp-shell-frame.tsx` (~L360) opens every WP header/footer link in a new tab. Remove `target="_blank"`. Do **not** leave clicks trapped inside the sandboxed iframe: intercept `<a href>` (non-hash) and navigate the **parent** (`postMessage` → `window.top.location` / Next router for `/visa-processing/*`). Hash / `#pll_switcher` / menu toggles stay in-iframe.

- [ ] **Step 1:** Featured/Khaleej hidden; header height shrinks (no empty strip).
- [ ] **Step 2:** Apply/Track appear once (WP). Next bar is auth only.
- [ ] **Step 3:** WP menu click stays in the same tab; apply/track land on the Next app.

---

### Task 2: Nationality dial code (admin) + phone field (apply)

**Files:**
- Create: `drizzle/0027_nationality_dial_code.sql` (journal idx 26)
- Modify: `lib/db/schema/visa.ts` — `nationality.dialCode` text null
- Modify: `lib/admin/catalog/catalog-types.ts`, `get-catalog-entity.ts`
- Modify: `components/admin/catalog-nationality-form.tsx`
- Modify: `app/api/admin/catalog/nationalities/route.ts` (POST)
- Modify: `app/api/admin/catalog/nationalities/[code]/route.ts` (PATCH)
- Create: `lib/apply/phone-country.ts` + test
- Create: `components/apply/draft/phone-country-field.tsx`
- Modify: `applicant-review.tsx`

```sql
ALTER TABLE "nationality" ADD COLUMN "dial_code" text;
```

Admin form field: **Dial code** (digits only, no `+`). Empty = this nationality has no default; the customer must pick another country or type the full number. Francesco fills IN=`91`, NG=`234`, etc. on `/admin/catalog/nationalities/[code]`.

PATCH/POST:

```typescript
dialCode: z.string().regex(/^\d{1,6}$/).nullable().optional(),
```

Public nationalities list (or application payload) must include `dialCode` for the chosen nationality so the client can default.

```typescript
export const composeE164 = (dialDigits: string, nationalDigits: string): string => {
  const d = dialDigits.replace(/\D/g, "");
  const n = nationalDigits.replace(/\D/g, "");
  if (!d || !n) return n ? `+${n}` : "";
  return `+${d}${n}`;
};

export const splitStoredPhone = (
  stored: string,
  defaultDial: string,
): { dial: string; national: string } => {
  const digits = stored.replace(/\D/g, "");
  const fallback = defaultDial.replace(/\D/g, "");
  if (stored.startsWith("+") && fallback && digits.startsWith(fallback)) {
    return { dial: fallback, national: digits.slice(fallback.length) };
  }
  return { dial: fallback, national: digits };
};
```

UI: select of **catalog nationalities that have `dialCode`** (name + `+dial`) + national `type="tel"`. Default = application `nationality.dialCode`. PATCH still sends one E.164 `phone`.

If the nationality has no dial and the select is empty: show “Add a dial code for this nationality in Catalog” is **admin-only**. Customer copy: “Choose a country code” and require a selection from nationalities that *do* have dials (still catalog-driven).

- [ ] **Step 1:** PATCH test: `{ dialCode: "91" }` on IN persists.
- [ ] **Step 2:** `composeE164("91", "9876543210") === "+919876543210"`.
- [ ] **Step 3:** Browser: set IN dial in Catalog, start an India draft, phone defaults to +91.

There is **no** `DIAL_BY_ISO2` constant.

---

### Task 3: Resume hint API + banner

**Files:**
- Create: `app/api/applications/resume-hint/route.ts` (`export const runtime = "nodejs"`)
- Create: `lib/applications/resume-hint.ts` + test
- Create: `components/apply/resume-banner.tsx`
- Modify: `app/(client)/page.tsx` and `/apply/start`

Cookie `vt_resume` is HttpOnly. Hint is GET that reads the cookie server-side.

- Hash cookie; find `application_party` by `resumeTokenHash` **or** any `application` with that hash and `paymentStatus` in `unpaid` | `checkout_created`.
- Expired (`draftExpiresAt < now`, TTL already admin) or paid → `{ hint: null }`.
- Else no PII except:

```typescript
export type TResumeHint = {
  primaryApplicationId: string;
  partyId: string | null;
  travelerCount: number;
  nationalityName: string;
  serviceName: string;
  href: string;
};
```

Banner: “Continue your application — {nationalityName} · {serviceName}” / “{N} traveler(s)” / Continue. CTA label from Settings Task 4 (`resumeBannerCta`), default `Continue`.

- [ ] **Step 1:** Tests: expired → null; paid → null; valid unpaid → hint.

---

### Task 4: Admin apply-home SEO, blog links, resume CTA

**Files:**
- Create: `lib/apply/apply-home-copy.ts` + test
- Create: `components/admin/apply-home-seo-settings.tsx`
- Create: `components/admin/apply-blog-link-settings.tsx`
- Modify: `app/admin/(protected)/settings/page.tsx`
- Modify: `app/(client)/page.tsx` metadata + hero (read via `withSystemDbActor`, not client fetch of admin APIs)
- Modify: `lib/seo/home-page-facts.ts`, `lib/seo/home-page-json-ld.ts`
- Create: `components/apply/apply-blog-link-row.tsx`

```typescript
export const PLATFORM_KEY_APPLY_HOME_SEO = "apply_home_seo";
export type TApplyHomeSeo = {
  title: string;
  description: string;
  h1: string;
  sub: string;
  timingFact: string;
  resumeBannerCta: string;
  howItWorksHref: string | null;
};

export const DEFAULT_APPLY_HOME_SEO: TApplyHomeSeo = {
  title: "UAE Tourist Visa from Nigeria, Turkey, South Africa, Egypt & more | VisaTop",
  description:
    "Apply online for a UAE tourist or transit visa. Choose your nationality, pick your stay, pay securely. All fees included.",
  h1: "Apply for your UAE tourist visa",
  sub: "Start from your nationality. All fees included — no hidden charges.",
  timingFact:
    "We start processing after payment. Immigration decision times vary — we review your file and keep you updated.",
  resumeBannerCta: "Continue",
  howItWorksHref: null,
};

export const PLATFORM_KEY_APPLY_BLOG_LINKS = "apply_blog_links";
export type TApplyBlogLink = { label: string; href: string };
export const DEFAULT_APPLY_BLOG_LINKS: TApplyBlogLink[] = [];
```

Empty blog list → **do not render** the row. Francesco adds rows in Settings (label + href). No placeholder visatop.com URLs in source.

Settings UI: same card chrome as draft TTL. `settings.write` + audit `settings.apply_home_seo.update` / `settings.apply_blog_links.update`.

JSON-LD timing line **must** use `timingFact` from the setting.

- [ ] **Step 1:** Parse tests: invalid JSON → defaults; empty blog array → [].
- [ ] **Step 2:** Change H1 in Settings, reload apply home — H1 updates without a code change.

---

### Task 5: Signed email resume link

**Files:**
- Create: `lib/applications/resume-email-link.ts` + test
- Create: `app/(client)/apply/resume/page.tsx` + `app/api/apply/resume/route.ts`
- Modify: `lib/email/transactional-email-kinds.ts`
- Call from `POST /api/applications` after guest create (fire-and-forget)

Reuse HMAC style from `guest-link-intent.ts`. TTL = min(48h, remaining `draftExpiresAt` seconds from admin TTL).

```typescript
type TResumePayload = { partyId: string; primaryApplicationId: string; exp: number };
```

Secret: `GUEST_LINK_INTENT_SECRET`. Do **not** put the cookie plaintext in the email.

`GET /apply/resume?t=`: verify → load party/primary → reject paid/expired → rotate resume token (new hash on party + all members) → `Set-Cookie: vt_resume` → 302 to `/apply/applications/:primaryApplicationId`.

Missing secret in dev: skip send (log). Invalid page: “This resume link is invalid or expired” + link to `/apply/track`.

Kind: `APPLICATION_DRAFT_STARTED`. Body: nationality name, product name, traveler count, button using `resumeBannerCta`, expires with draft TTL. No OCR, no filenames.

- [ ] **Step 1:** sign/verify; expired exp fails; tampered mac fails.

---

### Task 6: Track Continue when cookie matches

**Files:**
- Modify: `app/api/applications/track-lookup` + `route.test.ts`
- Modify: `components/apply/application-track-lookup-form.tsx`
- Modify: signed-in list if needed (already has Continue)

Per row: `canContinue: boolean`, `continueHref: string | null`.

- Guest: true only when request `vt_resume` verifies against that row/party hash **and** unpaid or checkout_created.
- Else false. Paid: **View status** → submitted URL.

Do not expose `canContinue: true` without cookie match.

- [ ] **Step 1:** Extend `track-lookup/route.test.ts`.

---

### Task 7: i18n — Polylang locales on the Next.js client (design, then implement)

**Do not implement until the user signs off the design in this task.** Dynamic = locale list and WP chrome come from WordPress at request time; Next copy is keyed to those slugs. Do not hardcode “ten languages.”

**Live inventory** (2026-09-07, `GET https://visatop.com/wp-json/pll/v1/languages` and `GET /wp-json/headless/v1/layout?include=menus&lang=ar`):

| Slug | Locale | Name | RTL | Home |
|---|---|---|---|---|
| `en` | `en_GB` | English (**default**) | no | `https://visatop.com/` |
| `fr` | `fr_FR` | Français | no | `/fr/` |
| `es` | `es_ES` | Español | no | `/es/` |
| `it` | `it_IT` | Italiano | no | `/it/` |
| `tr` | `tr_TR` | Türkçe | no | `/tr/` |
| `ar` | `ar` | العربية | **yes** | `/ar/` |
| `de` | `de_DE` | Deutsch | no | `/de/` |
| `hi` | `hi_IN` | हिन्दी | no | `/hi/` |
| `tl` | `tl` | Tagalog | no | `/tl/` |
| `ru` | `ru_RU` | Русский | no | `/ru/` |
| `ha` | `ha_NG` | Hausa | no | `/ha/` |

That is **11** active languages (not 10). Layout payload already includes `language.requested`, `language.current`, `language.available[]`. `fetchWpShellModel` already accepts `lang` but `(client)/layout.tsx` does **not** pass it. `DISABLE_WP_LANG_SWITCHER` currently hides the Polylang control.

**Already true:** WP Apply/Track labels translate when `?lang=` is set (Arabic example: تقديم على التأشيرة / تتبع التأشيرة).

**Locked UX (2026-09-07):**

- **WP is the entry source of truth.** Non-English WP menus/CTAs will be updated in the WP dashboard to land on the Next app with a locale query, e.g. `/visa-processing?locale=ar` and `/visa-processing/apply/track?locale=ar`. English may omit the param or use `locale=en`.
- Next **reads `locale`** (Polylang slug: `en|fr|es|it|tr|ar|de|hi|tl|ru|ha`). Unknown/missing → `en`. Persist in a cookie so later `/apply/...` hops keep the language without repeating the query.
- One language control that **looks like the WP header pill** and sits **in the WP navbar we embed**. It switches **Next.js** (cookie + optional URL rewrite). Do **not** send the user to `visatop.com/{lang}/`.
- Native Polylang in the headless iframe is **broken** — keep it hidden. Inject the lookalike; clicks `postMessage` the slug to the parent.
- After locale is known, pass it into `fetchWpShellModel({ lang })` so embedded Apply/Track labels match (still no navigation to the WP site).

**WP dashboard checklist (ops, not a deploy):** for each Polylang menu, set Apply / Apply Now / Track to the Next paths **plus** `?locale={slug}`. Same-tab. Do not point those items at `visatop.com/{slug}/` if the user is starting an application.

**Open decisions (resolve with the user before code):**

1. **Scope** — customer apply/track/auth in v1, vs also admin.
2. **Who edits Next strings** — repo message files vs Francesco-editable Settings.
3. **RTL** — `ar` must flip the Next apply canvas (recommended yes).

- [ ] **Step 1:** User approves v1 scope and who edits strings.
- [ ] **Step 2:** Spec `docs/superpowers/specs/YYYY-MM-DD-apply-i18n-design.md` (do not commit until approved).
- [ ] **Step 3:** Implement only what that spec locks. Tests: `?locale=ar` sets `ar` + `dir=rtl`; unknown slug → `en`; cookie survives a hop to `/apply/start`; layout fetch includes `lang`.

---

### Task 8: Phase C verification + Grok QA handoff

```bash
pnpm exec vitest run lib/apply/phone-country.test.ts lib/apply/apply-home-copy.test.ts lib/applications/resume-email-link.test.ts lib/applications/resume-hint.test.ts app/api/applications/track-lookup/route.test.ts app/api/admin/catalog/nationalities
pnpm run lint
pnpm run test:ci
```

`pnpm run build` before claiming staging-ready. Include i18n tests from Task 7 once that spec is implemented.

---

## Manual QA plan (hand to Grok on local `pnpm dev`)

Base path: `/visa-processing`. Real browser, not a screenshot.

### Personas (catalog + Document rules — not ISO lists)

Francesco must have, **in admin**, before QA:

| Setup | Where |
|---|---|
| India / Nigeria / France / transit SKUs priced and eligible | Catalog + service prices |
| Stay / entry / traveler kind set on those SKUs | Service edit |
| Bank (or any extra) assigned only where he wants it | Document rules |
| IN `dialCode` = 91 | Nationality page |
| Multi-traveller on + max ≥ 2 | Settings |
| Apply-home SEO filled; optional blog rows | Settings |

| # | Path | Expect |
|---|---|---|
| 1 | India 15–30 single adult tourist | Guided shortlist (not 10 cards). Email on step 2. Docs = passport, photo, **plus Document rules extras**. Pay copy ≠ complete if empty. |
| 2 | Nigeria same | Same extras Francesco assigned (not a coded Africa list). |
| 3 | France same | Passport + photo only if no extras assigned. |
| 4 | India transit | Transit SKU only if `stayBucket=transit`. No tourist cards mixed in. Extras only if assigned. |
| 5 | India adult + child | Two doc sections. One checkout total = sum. Badges = Settings strings. |
| 6 | Invalid passport date | Warning; Pay still enabled. |
| 7 | Guest new draft | Resume banner. Track: product + country names. Continue only same browser. |
| 8 | Resume email (Mailhog/log) | Sets cookie, opens primary. Expired token → error + track. |
| 9 | Other browser, track only | Status, no Continue. |
| 10 | Upload | No filename/KB/internal status. Oversized file shows “File exceeds 8MB limit.” Preview + Replace OK. |
| 11 | Admin | Change H1 / add blog link / change IN dial / hide a SKU from chooser — apply reflects it without a deploy. |

### Chrome

- No STEP n/5 overlay (already shipped).
- No Featured-on / Khaleej time strip on the WP header.
- Apply and Track appear **once** (WP header). Next bar is Login / Account only.
- WP header/footer links open in the **same** tab (not `target="_blank"`).
- No autoplay (already shipped).
- Phone: dial from Catalog; India defaults to +91 only after Francesco set it.

### Pay-first (Phase B — do not regress)

- Pay requires **email + every required document slot**. Missing name/DOB/phone warn only.
- Duplicate-tap does not create two checkouts.
- After pay: customer status paid / in progress — no “automation failed”.

### i18n (after Task 7 sign-off)

- Switching language updates WP chrome **and** Next apply/track copy for that Polylang slug.
- Arabic is RTL on the apply canvas.
- Unknown/new slug falls back to English until catalogs exist.

### Do not pass if

- Raw `serviceId` / ISO-only nationality on track.
- Payment says complete while slots empty.
- Extra slot appears because of a **coded** region list rather than Document rules.
- Child SKU chosen via name regex instead of `travelerKind`.
- Multi-traveller checkout charges only the primary.
- Resume token or passport fields in localStorage.
- Apply-home title/H1/blog/dial only editable in git.

**Staging:** only after this list is green locally.

---

## Suggested commit (only if orchestrator asks)

```
feat(apply): tourist shell, admin SEO/dial, and signed resume email
```
