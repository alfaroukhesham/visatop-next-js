# Phase C — Shell, resume, SEO

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Prerequisite:** Phase B complete and Cursor-reviewed.  
> **Executor:** OpenCode. **Reviewer:** Cursor.  
> **Index:** [2026-09-05-tourist-journey-README.md](./2026-09-05-tourist-journey-README.md)

**Goal:** Tourist-only chrome (no coach overlay, no Featured bar, no autoplay, Status not pre-pay), phone country-code picker, **resume banner + signed email link + track Continue**, visa-processing H1/meta + blog row, EN message catalog.

**Architecture:** Reuse `vt_resume` and HMAC pattern from `lib/applications/guest-link-intent.ts`. Resume token is **not** the cookie plaintext in email — sign `{ partyId, exp }` (or primary `applicationId` if no party) with `GUEST_LINK_INTENT_SECRET`. GET `/apply/resume?t=` sets `vt_resume` and redirects. Track already has names from Phase A; add Continue when the cookie matches a listed row.

**Tech Stack:** Existing apply layout, `WpShellFrame`, `HomeDemoVideo`, Mailgun transactional kinds, Next `metadata` on `app/(client)/page.tsx`.

---

## File map

| Area | Create | Modify |
|---|---|---|
| Chrome | — | `apply-journey-step-bar.tsx` usage sites, `apply-steps-rail.tsx`, `wp-shell-frame.tsx`, `home-demo-video.tsx`, `app/(client)/page.tsx` |
| Phone | `lib/apply/phone-country.ts`, `components/apply/draft/phone-country-field.tsx` | `applicant-review.tsx` |
| Resume | `lib/applications/resume-email-link.ts`, `app/api/applications/resume-hint/route.ts`, `app/(client)/apply/resume/page.tsx`, `components/apply/resume-banner.tsx` | create-draft route (send email), track form |
| SEO | `lib/seo/apply-home-copy.ts` | `app/(client)/page.tsx`, `lib/seo/home-page-facts.ts`, `lib/seo/home-page-json-ld.ts` |
| i18n | `lib/i18n/apply-messages.ts` | apply strings that Phase B/C added |

---

### Task 1: Kill coach overlay + Status-as-pre-pay + autoplay + Featured bar

**Files:**
- Modify: `app/(client)/page.tsx`, start page, draft/payment pages — **stop rendering** `ApplyJourneyStepBar`.
- Modify: `components/apply/apply-steps-rail.tsx`
- Modify: `components/client/wp-shell/wp-shell-frame.tsx`
- Modify: `components/client/home-demo-video.tsx` / home page

**Rail:** remove step 5 (Status) from the pre-pay list. Four steps only:

1. Nationality  
2. Visa  
3. Documents  
4. Payment  

`currentStep` type becomes `1 | 2 | 3 | 4`. Submitted page has **no** pre-pay rail (or a post-pay status heading, not “Step 5”).

Update `hrefForStep` / `ApplyTwoColumn` callers so they pass 1–4 only.

**Featured / Khaleej bar:** in `WpShellFrame` tourist CSS, hide WP featured strip on apply routes:

```css
header#header .featured_on,
header#header .time_in_uae {
  display: none !important;
}
```

(Adjust selectors to match the live WP markup already targeted in that file.)

**Video:** remove `<HomeDemoVideo />` from `app/(client)/page.tsx`. Do not autoplay anywhere. If a Help link is desired, a text link “How it works” to an existing WP page is enough — no new video player.

- [ ] **Step 1:** Grep `ApplyJourneyStepBar` and `HomeDemoVideo`; remove from tourist apply surfaces.
- [ ] **Step 2:** Rail is 4 steps. `pnpm exec vitest run` if any layout tests exist; otherwise visual check in review.

---

### Task 2: Phone country-code picker

**Files:**
- Create: `lib/apply/phone-country.ts` + test
- Create: `components/apply/draft/phone-country-field.tsx`
- Modify: `applicant-review.tsx`

```typescript
export type TDialCountry = { code: string; name: string; dial: string };

/** Minimal ISO2 → dial. Include IN, NG, TR, EG, ZA, AE, FR, US, GB. */
export const DIAL_BY_ISO2: Record<string, string> = {
  IN: "91",
  NG: "234",
  TR: "90",
  EG: "20",
  ZA: "27",
  AE: "971",
  FR: "33",
  US: "1",
  GB: "44",
};

export const defaultDialForNationality = (nationalityCode: string): string =>
  DIAL_BY_ISO2[nationalityCode.trim().toUpperCase()] ?? "";

export const composeE164 = (dialDigits: string, nationalDigits: string): string => {
  const d = dialDigits.replace(/\D/g, "");
  const n = nationalDigits.replace(/\D/g, "");
  if (!d || !n) return n ? `+${n}` : "";
  return `+${d}${n}`;
};

export const splitStoredPhone = (
  stored: string,
  nationalityCode: string,
): { dial: string; national: string } => {
  const digits = stored.replace(/\D/g, "");
  const fallback = defaultDialForNationality(nationalityCode);
  if (stored.startsWith("+") && fallback && digits.startsWith(fallback)) {
    return { dial: fallback, national: digits.slice(fallback.length) };
  }
  return { dial: fallback, national: digits };
};
```

Tests: India default `91`; compose `91` + `9876543210` → `+919876543210`.

UI: country select (name + `+dial`) + national number input `type="tel"`. PATCH still sends one `phone` string (E.164). Default dial from application `nationalityCode`.

---

### Task 3: Resume hint API + banner

**Files:**
- Create: `app/api/applications/resume-hint/route.ts` (`export const runtime = "nodejs"`)
- Create: `lib/applications/resume-hint.ts` + test
- Create: `components/apply/resume-banner.tsx`
- Modify: `app/(client)/page.tsx` and `/apply/start`

Cookie `vt_resume` is HttpOnly — the client **cannot** read it. Hint is a **GET** that reads the cookie server-side.

`resume-hint.ts`:

- Hash the plaintext cookie; find `application_party` by `resumeTokenHash` **or** any `application` with that hash and `paymentStatus` in `unpaid` | `checkout_created`.
- If draft expired (`draftExpiresAt < now`) or paid → `{ hint: null }`.
- Else return **no PII** except:

```typescript
export type TResumeHint = {
  primaryApplicationId: string;
  partyId: string | null;
  travelerCount: number;
  nationalityName: string;
  serviceName: string;
  href: string; // /apply/applications/:primaryId
};
```

Route: `jsonOk({ hint })`. 200 with `hint: null` is fine (not 401).

Banner (client): fetch hint on home + start. If present:

> Continue your application — {nationalityName} · {serviceName}  
> {N} traveler(s) · **Continue**

Link to `href`. No document names, no email, no passport.

Tests: expired → null; paid → null; valid unpaid → hint.

---

### Task 4: Signed email resume link

**Files:**
- Create: `lib/applications/resume-email-link.ts` + test
- Create: `app/(client)/apply/resume/page.tsx` + `app/api/apply/resume/route.ts` (POST or GET handler)
- Modify: `lib/email/transactional-email-kinds.ts`
- Add send helper (follow `send-application-transactional-emails.ts` patterns)
- Call from `POST /api/applications` after guest create (fire-and-forget, same as other emails)

Reuse HMAC style from `guest-link-intent.ts`:

```typescript
export const RESUME_LINK_TTL_SEC = 48 * 3600; // overridden at send time by remaining draft TTL seconds if shorter

type TResumePayload = { partyId: string; primaryApplicationId: string; exp: number };

export const signResumeLink = (
  partyId: string,
  primaryApplicationId: string,
  opts?: { secret?: string; nowSec?: number; ttlSec?: number },
): string => { /* HMAC base64url payload.mac — same construction as signGuestLinkIntent */ };

export const verifyResumeLink = (
  token: string,
  opts?: { secret?: string; nowSec?: number },
): { ok: true; partyId: string; primaryApplicationId: string } | { ok: false } => { /* ... */ };
```

Secret: `GUEST_LINK_INTENT_SECRET` (already ≥32 bytes). Do **not** put the cookie plaintext in the email.

`GET /apply/resume?t=`:

1. Verify token.
2. Load party / primary; reject if paid or expired.
3. Rotate or reuse existing resume token: if party has a hash, generate a **new** plaintext, store new hash on party **and all members**, `Set-Cookie: vt_resume`.
4. 302 to `/apply/applications/:primaryApplicationId`.

If secret missing in dev, skip send (log); page shows “This resume link is invalid or expired” + link to `/apply/track`.

New kind:

```typescript
APPLICATION_DRAFT_STARTED: "application_draft_started",
```

Email body (EN): nationality name, product name, traveler count, button “Continue your application”, expires with draft TTL. No OCR, no document filenames.

Tests: sign/verify; expired exp fails; tampered mac fails.

---

### Task 5: Track Continue when cookie matches

**Files:**
- Modify: `app/api/applications/track-lookup` response
- Modify: `components/apply/application-track-lookup-form.tsx`
- Modify: signed-in list if needed (already has Continue)

Add `canContinue: boolean` and `continueHref: string | null` per row:

- Guest: `canContinue` true when request `vt_resume` verifies against that row’s `resumeTokenHash` (or its party hash) **and** `paymentStatus` is unpaid or checkout_created.
- Else `canContinue` false (status-only). Footer copy stays for lost-cookie guests.

UI: **Continue** button → `/apply/applications/:id` (primary if party). Paid rows: **View status** → submitted URL.

Do not expose `canContinue: true` without cookie match.

Extend `track-lookup/route.test.ts`.

---

### Task 6: visa-processing H1, meta, facts, blog row

**Files:**
- Modify: `app/(client)/page.tsx` metadata + hero H1
- Modify: `lib/seo/home-page-facts.ts` (soften 2-working-days)
- Create: `components/apply/apply-blog-link-row.tsx`

**Meta / H1 (EN draft — Francesco can edit later):**

- Title: `UAE Tourist Visa from Nigeria, Turkey, South Africa, Egypt & more | VisaTop`
- Description: `Apply online for a UAE tourist or transit visa. Choose your nationality, pick your stay, pay securely. All fees included.`
- H1: `Apply for your UAE tourist visa`
- Sub: `Start from your nationality. All fees included — no hidden charges.`

**Timing fact** (replace the 2-working-days promise):

```typescript
"We start processing after payment. Immigration decision times vary — we review your file and keep you updated."
```

**Blog row:** one horizontal list under the hero (not the 10-card wall). Use **placeholders Francesco can swap** — public visatop.com posts, `rel` external if they leave `/visa-processing`:

| Label | Href |
|---|---|
| UAE tourist visa guide | `https://visatop.com/uae-tourist-visa/` |
| Transit visa | `https://visatop.com/uae-transit-visa/` |
| Documents checklist | `https://visatop.com/uae-visa-requirements/` |

If those slugs 404, keep the component and hrefs as constants in `lib/seo/apply-blog-links.ts` so ops can edit one file. Do not invent a mass blog program.

JSON-LD `HOME_SERVICE_FACTS` must match the softened timing line.

---

### Task 7: EN apply message catalog (structure only)

**Files:**
- Create: `lib/i18n/apply-messages.ts`

There is no next-intl. Do **not** add a new i18n framework. Extract **new** Phase A–C user-visible strings into one map:

```typescript
export const APPLY_MESSAGES_EN = {
  continueWithThisVisa: "Continue with this visa",
  allFeesIncluded: "All fees included",
  noHiddenCharges: "No hidden charges",
  payFirstIncomplete: "Pay now to start processing. You can add remaining documents and details after payment.",
  bankStatement6m: "Last 6 months bank account statement",
  resumeBannerCta: "Continue",
  phoneLabel: "Phone",
} as const;

export type TApplyMessageKey = keyof typeof APPLY_MESSAGES_EN;

export const applyMessage = (key: TApplyMessageKey): string => APPLY_MESSAGES_EN[key];
```

Wire the chooser, badges, payment copy, bank slot label, and resume banner through `applyMessage`. Extra locales = additional maps later; v1 EN only.

---

### Task 8: Phase C verification + Grok QA handoff

```bash
pnpm exec vitest run lib/apply/phone-country.test.ts lib/applications/resume-email-link.test.ts lib/applications/resume-hint.test.ts app/api/applications/track-lookup/route.test.ts
pnpm run lint
pnpm run test:ci
```

`pnpm run build` before claiming the branch ready for staging (CI rule).

---

## Manual QA plan (hand to Grok on local `pnpm dev`)

Base path: `/visa-processing`. Use a real browser, not a single screenshot.

### Personas

| # | Nationality | Path | Expect |
|---|---|---|---|
| 1 | India | 15–30, single, adult tourist | Guided shortlist (not 10 cards). Email on step 2. Docs: passport, photo, **bank 6m**. Pay copy ≠ “complete” if empty. |
| 2 | Nigeria | same | Bank slot present. |
| 3 | France | same | Passport + photo only. No bank. |
| 4 | India | Transit | No bank. Transit not mixed with tourist cards. |
| 5 | India | Adult + child (2 travelers) | Two doc sections. Checkout **one** total = sum. Badges visible. |
| 6 | Any | Invalid/expired passport date | Warning; Pay still enabled. |
| 7 | Guest | New draft | Home/start **resume banner**. Track: product + country names. Continue only in same browser. |
| 8 | Guest | Resume email link (Mailhog/log) | Sets cookie, opens primary draft. Expired token → error + track. |
| 9 | Guest | Other browser, track only | Status, **no** Continue. |
| 10 | Chrome | Upload | No filename, KB, `needs_manual`, retry counts. Preview + Replace OK. |

### Chrome

- No STEP n/5 overlay covering the CTA.
- No Featured-on / Khaleej strip on apply home.
- No autoplay video.
- Rail: 4 pre-pay steps; Status not listed before pay.
- Phone: country dial + number; India defaults to +91.
- H1/meta/blog row present on apply home.

### Pay-first

- Empty docs + blank name still reach checkout (sandbox). Duplicate-tap does not create two checkouts (existing guard).
- After pay with empty bank (India): customer status is paid / in progress — no “automation failed”. Admin still sees OCR internals.

### Do not pass if

- Raw `serviceId` / ISO-only nationality on track.
- Payment says application is complete while slots empty.
- Bank slot on transit or France tourist.
- Missing bank slot on India/Nigeria non-transit.
- Party checkout charges only the primary’s price.
- Resume token or passport fields stored in localStorage.

**Staging:** only after this list is green locally.

---

## Suggested commit (only if orchestrator asks)

```
feat(apply): tourist shell, resume banner and signed resume email
```
