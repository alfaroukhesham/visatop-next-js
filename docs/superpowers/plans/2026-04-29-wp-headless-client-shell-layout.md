# WP Headless Client Shell Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a WordPress-driven global header/footer (menus + safe CSS assets) for all `app/(client)` routes, while keeping existing app headers as a secondary bar below the WP header, and ensuring links work correctly under the `/visa-processing` base path.

**Architecture:** Server Components fetch a normalized “WP layout model” from `GET /wp-json/headless/v1/layout?include=menus,css&lang=…` with ISR. UI is rendered by local React components (`WpShellHeader`, `WpShellFooter`) plus a safe stylesheet injector. Failures fall back to minimal local shell components without blocking page rendering.

**Tech Stack:** Next.js App Router (RSC), `fetch` with `next.revalidate`, TypeScript, Vitest.

---

## File structure (what we will create/modify)

**Create:**
- `lib/wp-headless/types.ts` — TypeScript types for the endpoint payload + normalized model.
- `lib/wp-headless/normalize-links.ts` — pure function: WP URL → internal/external link model (basePath-aware).
- `lib/wp-headless/allowlist-css.ts` — pure function: filter + dedupe CSS URLs by protocol + host allowlist.
- `lib/wp-headless/fetch-layout.ts` — server utility to fetch layout, apply normalization, and return a safe model (or `null`).
- `components/client/wp-shell/wp-css-links.tsx` — renders `<link rel="stylesheet">` tags from safe URLs.
- `components/client/wp-shell/wp-shell-header.tsx` — renders header menu tree from normalized model.
- `components/client/wp-shell/wp-shell-footer.tsx` — renders footer menu tree from normalized model.
- `components/client/wp-shell/wp-shell-fallback.tsx` — minimal local header/footer used when WP is unavailable.
- `lib/wp-headless/normalize-links.test.ts` — unit tests (Vitest).
- `lib/wp-headless/allowlist-css.test.ts` — unit tests (Vitest).

**Modify:**
- `app/(client)/layout.tsx` — mount WP header + CSS links + footer around `{children}`; remove `ClientShellFooter`.
 
**Create:**
- `app/(client)/head.tsx` — inject safe WP CSS `<link>` tags for the client segment.

---

### Task 1: Implement and test link normalization (basePath-safe)

**Files:**
- Create: `lib/wp-headless/types.ts`
- Create: `lib/wp-headless/normalize-links.ts`
- Test: `lib/wp-headless/normalize-links.test.ts`

- [ ] **Step 1: Add types**

Create `lib/wp-headless/types.ts`:

```ts
export type WpMenuItemRaw = {
  id?: string | number;
  title?: string;
  label?: string;
  url?: string;
  children?: WpMenuItemRaw[];
};

export type WpHeadlessLayoutResponse = {
  menus?: {
    header_menu?: WpMenuItemRaw[] | null;
    footer_menu?: WpMenuItemRaw[] | null;
  } | null;
  css?: Array<{ id?: string | number; url?: string | null }> | null;
};

export type NormalizedWpLink =
  | { kind: "internal"; href: string; label: string } // href is app-internal path like "/apply/start"
  | { kind: "external"; href: string; label: string };

export type NormalizedWpMenuItem = {
  id: string;
  label: string;
  link: NormalizedWpLink;
  children: NormalizedWpMenuItem[];
};

export type WpShellModel = {
  headerMenu: NormalizedWpMenuItem[];
  footerMenu: NormalizedWpMenuItem[];
  cssUrls: string[];
};
```

- [ ] **Step 2: Write the failing tests**

Create `lib/wp-headless/normalize-links.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeWpMenuUrl } from "./normalize-links";

describe("normalizeWpMenuUrl", () => {
  it("treats /visa-processing/* as internal and strips the basePath", () => {
    const out = normalizeWpMenuUrl({
      url: "/visa-processing/apply/start",
      label: "Apply",
      appBasePath: "/visa-processing",
      appOrigin: "https://visatop.com",
    });

    expect(out.kind).toBe("internal");
    expect(out.href).toBe("/apply/start");
  });

  it("treats same-origin absolute /visa-processing/* as internal and strips it", () => {
    const out = normalizeWpMenuUrl({
      url: "https://visatop.com/visa-processing/portal",
      label: "Portal",
      appBasePath: "/visa-processing",
      appOrigin: "https://visatop.com",
    });

    expect(out.kind).toBe("internal");
    expect(out.href).toBe("/portal");
  });

  it("treats same-origin links outside /visa-processing as external", () => {
    const out = normalizeWpMenuUrl({
      url: "https://visatop.com/blog",
      label: "Blog",
      appBasePath: "/visa-processing",
      appOrigin: "https://visatop.com",
    });

    expect(out.kind).toBe("external");
    expect(out.href).toBe("https://visatop.com/blog");
  });

  it("treats other origins as external", () => {
    const out = normalizeWpMenuUrl({
      url: "https://example.com/pricing",
      label: "Pricing",
      appBasePath: "/visa-processing",
      appOrigin: "https://visatop.com",
    });

    expect(out.kind).toBe("external");
    expect(out.href).toBe("https://example.com/pricing");
  });

  it("falls back to external for empty/invalid urls", () => {
    const out = normalizeWpMenuUrl({
      url: "",
      label: "Empty",
      appBasePath: "/visa-processing",
      appOrigin: "https://visatop.com",
    });

    expect(out.kind).toBe("external");
    expect(out.href).toBe("#");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm test -- lib/wp-headless/normalize-links.test.ts
```

Expected: FAIL (module/function not found).

- [ ] **Step 4: Implement normalization**

Create `lib/wp-headless/normalize-links.ts`:

```ts
import type { NormalizedWpLink } from "./types";

function normalizeOrigin(raw: string): string | null {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeBasePath(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const withSlash = t.startsWith("/") ? t : `/${t}`;
  return withSlash === "/" ? "" : withSlash.replace(/\/$/, "");
}

function stripBasePath(pathname: string, basePath: string): string | null {
  if (!basePath) return pathname;
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);
  return null;
}

export function normalizeWpMenuUrl(input: {
  url: string | undefined | null;
  label: string | undefined | null;
  appBasePath: string; // e.g. "/visa-processing"
  appOrigin: string; // e.g. "https://visatop.com"
}): NormalizedWpLink {
  const label = (input.label ?? "").trim() || "Untitled";
  const url = (input.url ?? "").trim();
  const basePath = normalizeBasePath(input.appBasePath);
  const appOrigin = normalizeOrigin(input.appOrigin);

  if (!url) return { kind: "external", href: "#", label };

  // Relative path: only treat as internal if it targets the app mount.
  if (url.startsWith("/")) {
    const stripped = stripBasePath(url, basePath);
    if (stripped == null) return { kind: "external", href: url, label };
    return { kind: "internal", href: stripped || "/", label };
  }

  // Absolute URL.
  try {
    const u = new URL(url);
    if (appOrigin && `${u.protocol}//${u.host}`.toLowerCase() === appOrigin) {
      const stripped = stripBasePath(u.pathname, basePath);
      if (stripped != null) {
        const nextPath = (stripped || "/") + (u.search || "") + (u.hash || "");
        return { kind: "internal", href: nextPath, label };
      }
    }
    return { kind: "external", href: url, label };
  } catch {
    return { kind: "external", href: "#", label };
  }
}
```

- [ ] **Step 5: Re-run tests**

Run:

```bash
pnpm test -- lib/wp-headless/normalize-links.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/wp-headless/types.ts lib/wp-headless/normalize-links.ts lib/wp-headless/normalize-links.test.ts
git commit -m "feat(wp-shell): normalize WP menu links for basePath"
```

---

### Task 2: Implement and test CSS URL allowlisting (protocol + host + dedupe)

**Files:**
- Create: `lib/wp-headless/allowlist-css.ts`
- Test: `lib/wp-headless/allowlist-css.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/wp-headless/allowlist-css.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { allowlistWpCssUrls } from "./allowlist-css";

describe("allowlistWpCssUrls", () => {
  it("keeps only https urls on allowlisted hosts and dedupes", () => {
    const out = allowlistWpCssUrls(
      [
        "https://wp.visatop.com/wp-content/themes/site.css",
        "https://wp.visatop.com/wp-content/themes/site.css",
        "http://wp.visatop.com/insecure.css",
        "https://evil.example.com/x.css",
        "not-a-url",
      ],
      { allowedHosts: ["wp.visatop.com"] }
    );

    expect(out).toEqual(["https://wp.visatop.com/wp-content/themes/site.css"]);
  });

  it("accepts multiple allowed hosts", () => {
    const out = allowlistWpCssUrls(
      [
        "https://cdn.visatop.com/a.css",
        "https://wp.visatop.com/b.css",
        "https://www.visatop.com/c.css",
      ],
      { allowedHosts: ["cdn.visatop.com", "wp.visatop.com"] }
    );

    expect(out).toEqual(["https://cdn.visatop.com/a.css", "https://wp.visatop.com/b.css"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- lib/wp-headless/allowlist-css.test.ts
```

Expected: FAIL (module/function missing).

- [ ] **Step 3: Implement allowlisting**

Create `lib/wp-headless/allowlist-css.ts`:

```ts
function normalizeHosts(hosts: string[]): Set<string> {
  const out = new Set<string>();
  for (const h of hosts) {
    const t = h.trim().toLowerCase();
    if (t) out.add(t);
  }
  return out;
}

export function allowlistWpCssUrls(
  urls: Array<string | null | undefined>,
  input: { allowedHosts: string[] }
): string[] {
  const allowed = normalizeHosts(input.allowedHosts);
  const deduped = new Set<string>();

  for (const raw of urls) {
    const t = (raw ?? "").trim();
    if (!t) continue;
    try {
      const u = new URL(t);
      if (u.protocol !== "https:") continue;
      if (!allowed.has(u.hostname.toLowerCase())) continue;
      // Normalize by dropping default port (URL keeps it out) and using full href.
      deduped.add(u.toString());
    } catch {
      // skip invalid
    }
  }

  return [...deduped];
}
```

- [ ] **Step 4: Re-run tests**

```bash
pnpm test -- lib/wp-headless/allowlist-css.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/wp-headless/allowlist-css.ts lib/wp-headless/allowlist-css.test.ts
git commit -m "feat(wp-shell): allowlist and dedupe WP css urls"
```

---

### Task 3: Fetch + normalize WP layout (ISR + fallbacks)

**Files:**
- Create: `lib/wp-headless/fetch-layout.ts`

- [ ] **Step 1: Implement server fetch utility**

Create `lib/wp-headless/fetch-layout.ts`:

```ts
import { allowlistWpCssUrls } from "./allowlist-css";
import { normalizeWpMenuUrl } from "./normalize-links";
import type { NormalizedWpMenuItem, WpHeadlessLayoutResponse, WpMenuItemRaw, WpShellModel } from "./types";

function toId(item: WpMenuItemRaw, idx: number): string {
  const raw = item.id ?? idx;
  return String(raw);
}

function toLabel(item: WpMenuItemRaw): string {
  return (item.title ?? item.label ?? "").trim() || "Untitled";
}

function normalizeMenuTree(input: {
  items: WpMenuItemRaw[] | null | undefined;
  appBasePath: string;
  appOrigin: string;
}): NormalizedWpMenuItem[] {
  const items = input.items ?? [];

  const walk = (node: WpMenuItemRaw, idx: number): NormalizedWpMenuItem => {
    const label = toLabel(node);
    return {
      id: toId(node, idx),
      label,
      link: normalizeWpMenuUrl({
        url: node.url,
        label,
        appBasePath: input.appBasePath,
        appOrigin: input.appOrigin,
      }),
      children: (node.children ?? []).map((c, j) => walk(c, j)),
    };
  };

  return items.map((n, i) => walk(n, i));
}

function parseAllowedHostsFromEnv(): string[] {
  const raw = process.env.WP_PUBLIC_ASSET_HOSTS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function fetchWpShellModel(input: {
  wpOrigin: string; // e.g. "https://wp.visatop.com"
  appOrigin: string; // e.g. "https://visatop.com"
  appBasePath: string; // "/visa-processing"
  lang?: string;
  revalidateSeconds?: number; // default 60
}): Promise<WpShellModel | null> {
  const include = "menus,css";
  const u = new URL("/wp-json/headless/v1/layout", input.wpOrigin);
  u.searchParams.set("include", include);
  if (input.lang) u.searchParams.set("lang", input.lang);

  const revalidateSeconds = input.revalidateSeconds ?? 60;

  // NOTE: keep failures non-fatal; return null to allow UI fallback.
  let json: WpHeadlessLayoutResponse;
  try {
    const res = await fetch(u.toString(), {
      next: { revalidate: revalidateSeconds },
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    json = (await res.json()) as WpHeadlessLayoutResponse;
  } catch {
    return null;
  }

  const headerMenu = normalizeMenuTree({
    items: json.menus?.header_menu ?? [],
    appBasePath: input.appBasePath,
    appOrigin: input.appOrigin,
  });

  const footerMenu = normalizeMenuTree({
    items: json.menus?.footer_menu ?? [],
    appBasePath: input.appBasePath,
    appOrigin: input.appOrigin,
  });

  const cssUrls = allowlistWpCssUrls(
    (json.css ?? []).map((a) => a.url ?? undefined),
    { allowedHosts: parseAllowedHostsFromEnv() }
  );

  return { headerMenu, footerMenu, cssUrls };
}
```

- [ ] **Step 2: Manual sanity check in dev**

Add env vars for local dev (example):

```bash
# .env.local
WP_ORIGIN="https://wp.visatop.com"
WP_PUBLIC_ASSET_HOSTS="wp.visatop.com,cdn.visatop.com"
NEXT_PUBLIC_APP_URL="http://localhost:3000/visa-processing"
```

Expected: `fetchWpShellModel()` can reach WP and returns a non-null model.

- [ ] **Step 3: Commit**

```bash
git add lib/wp-headless/fetch-layout.ts
git commit -m "feat(wp-shell): fetch and normalize WP shell model"
```

---

### Task 4: Build WP shell components (header/footer + css injector + fallback)

**Files:**
- Create: `components/client/wp-shell/wp-css-links.tsx`
- Create: `components/client/wp-shell/wp-shell-header.tsx`
- Create: `components/client/wp-shell/wp-shell-footer.tsx`
- Create: `components/client/wp-shell/wp-shell-fallback.tsx`

- [ ] **Step 1: CSS link renderer**

Create `components/client/wp-shell/wp-css-links.tsx`:

```tsx
import React from "react";

export function WpCssLinks({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <>
      {urls.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
    </>
  );
}
```

- [ ] **Step 2: Header component**

Create `components/client/wp-shell/wp-shell-header.tsx`:

```tsx
import Link from "next/link";
import type { NormalizedWpMenuItem } from "@/lib/wp-headless/types";

function MenuItem({ item }: { item: NormalizedWpMenuItem }) {
  const content =
    item.link.kind === "internal" ? (
      <Link href={item.link.href} className="hover:underline">
        {item.label}
      </Link>
    ) : (
      <a href={item.link.href} className="hover:underline">
        {item.label}
      </a>
    );

  return (
    <li className="flex flex-col gap-2">
      {content}
      {item.children.length > 0 ? (
        <ul className="ml-4 flex flex-col gap-2 border-l pl-4">
          {item.children.map((c) => (
            <MenuItem key={c.id} item={c} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WpShellHeader({ menu }: { menu: NormalizedWpMenuItem[] }) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex w-full max-w-[calc(1300px+3rem)] flex-col gap-4 px-5 py-4 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-semibold tracking-tight">
            Visatop
          </Link>
        </div>
        <nav aria-label="Primary">
          <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
            {menu.map((item) => (
              <MenuItem key={item.id} item={item} />
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Footer component**

Create `components/client/wp-shell/wp-shell-footer.tsx`:

```tsx
import Link from "next/link";
import type { NormalizedWpMenuItem } from "@/lib/wp-headless/types";

function FooterItem({ item }: { item: NormalizedWpMenuItem }) {
  const content =
    item.link.kind === "internal" ? (
      <Link href={item.link.href} className="hover:underline">
        {item.label}
      </Link>
    ) : (
      <a href={item.link.href} className="hover:underline">
        {item.label}
      </a>
    );

  return (
    <li className="flex flex-col gap-2">
      {content}
      {item.children.length > 0 ? (
        <ul className="ml-4 flex flex-col gap-2 border-l pl-4">
          {item.children.map((c) => (
            <FooterItem key={c.id} item={c} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function WpShellFooter({ menu }: { menu: NormalizedWpMenuItem[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t bg-white py-10 text-sm">
      <div className="mx-auto flex w-full max-w-[calc(1300px+3rem)] flex-col gap-6 px-5 sm:px-8">
        <nav aria-label="Footer">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {menu.map((item) => (
              <FooterItem key={item.id} item={item} />
            ))}
          </ul>
        </nav>
        <div className="text-muted-foreground">© {year} Visatop</div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Fallback UI**

Create `components/client/wp-shell/wp-shell-fallback.tsx`:

```tsx
import Link from "next/link";

export function WpShellFallbackHeader() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex w-full max-w-[calc(1300px+3rem)] items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="font-semibold tracking-tight">
          Visatop
        </Link>
        <nav aria-label="Primary">
          <ul className="flex items-center gap-5">
            <li>
              <Link href="/apply/start" className="hover:underline">
                Apply
              </Link>
            </li>
            <li>
              <Link href="/portal" className="hover:underline">
                Portal
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function WpShellFallbackFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t bg-white py-10 text-center text-sm text-muted-foreground">
      <div className="mx-auto w-full max-w-[calc(1300px+3rem)] px-5 sm:px-8">© {year} Visatop</div>
    </footer>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/client/wp-shell/
git commit -m "feat(wp-shell): add header/footer components and fallback"
```

---

### Task 5: Wire WP shell into `app/(client)/layout.tsx`

**Files:**
- Modify: `app/(client)/layout.tsx`
- Create: `app/(client)/head.tsx`

- [ ] **Step 1: Add `head.tsx` to inject WP CSS**

Create `app/(client)/head.tsx`:

```tsx
import { getAppOrigin } from "@/lib/app-url";
import { fetchWpShellModel } from "@/lib/wp-headless/fetch-layout";
import { WpCssLinks } from "@/components/client/wp-shell/wp-css-links";

export default async function Head() {
  const wpOrigin = process.env.WP_ORIGIN ?? "";
  if (!wpOrigin.trim()) return null;

  const model = await fetchWpShellModel({
    wpOrigin,
    appOrigin: getAppOrigin(),
    appBasePath: "/visa-processing",
    revalidateSeconds: 60,
  });

  if (!model?.cssUrls.length) return null;
  return <WpCssLinks urls={model.cssUrls} />;
}
```

- [ ] **Step 2: Update layout to fetch + render WP header/footer**

Replace `ClientShellFooter` usage and wrap children:

```tsx
import { Inter, Noto_Serif } from "next/font/google";
import type { ReactNode } from "react";
import { getAppOrigin } from "@/lib/app-url";
import { fetchWpShellModel } from "@/lib/wp-headless/fetch-layout";
import { WpShellHeader } from "@/components/client/wp-shell/wp-shell-header";
import { WpShellFooter } from "@/components/client/wp-shell/wp-shell-footer";
import { WpShellFallbackFooter, WpShellFallbackHeader } from "@/components/client/wp-shell/wp-shell-fallback";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const notoSerif = Noto_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600"],
});

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const wpOrigin = process.env.WP_ORIGIN ?? "";
  const appOrigin = getAppOrigin();
  const appBasePath = "/visa-processing";

  const model =
    wpOrigin.trim().length > 0
      ? await fetchWpShellModel({
          wpOrigin,
          appOrigin,
          appBasePath,
          revalidateSeconds: 60,
        })
      : null;

  return (
    <div
      data-ui="client"
      className={`theme-client theme-client-page-canvas ${inter.variable} ${notoSerif.variable} flex min-h-dvh flex-col text-[18px] leading-[1.6] antialiased`}
    >
      {model ? <WpShellHeader menu={model.headerMenu} /> : <WpShellFallbackHeader />}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {model ? <WpShellFooter menu={model.footerMenu} /> : <WpShellFallbackFooter />}
    </div>
  );
}
```

- [ ] **Step 3: Run dev + click around**

Run:

```bash
pnpm dev
```

Checklist:
- Header appears on `/visa-processing` and `/visa-processing/apply/start`
- `ClientAppHeader` still appears on apply routes **below** WP header
- Footer is WP footer (no `ClientShellFooter`)
- WP menu internal links navigate correctly (no double `/visa-processing/visa-processing`)
- When WP is unreachable, fallback header/footer render and app still works

- [ ] **Step 4: Run unit tests**

```bash
pnpm test -- lib/wp-headless/normalize-links.test.ts lib/wp-headless/allowlist-css.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(client)/head.tsx app/(client)/layout.tsx
git commit -m "feat(wp-shell): mount wp header/footer in client layout"
```

---

## Self-review against spec

- **Spec: data-first, no `include=html`** → Implemented: fetch uses `include=menus,css`.
- **Spec: basePath-safe links** → Implemented + tested with `/visa-processing` stripping.
- **Spec: CSS allowlist/dedupe** → Implemented + tested (`WP_PUBLIC_ASSET_HOSTS`).
- **Spec: non-fatal failures** → `fetchWpShellModel()` returns `null` and layout uses fallback.
- **Spec: secondary nav stays below WP header** → by leaving route group headers untouched (e.g. `ClientAppHeader` in `app/(client)/apply/layout.tsx`).

## Execution choice

Plan complete and saved to `docs/superpowers/plans/2026-04-29-wp-headless-client-shell-layout.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - execute tasks in this session, batch execution with checkpoints

Which approach?

