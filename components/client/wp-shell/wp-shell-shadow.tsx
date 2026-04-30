"use client";

import { useEffect, useMemo, useRef } from "react";

const cssTextCache = new Map<string, Promise<string>>();

function getCssText(href: string): Promise<string> {
  const existing = cssTextCache.get(href);
  if (existing) return existing;
  const p = fetch(href, { credentials: "omit" })
    .then(async (r) => {
      if (!r.ok) throw new Error(`Failed to fetch css: ${href}`);
      return await r.text();
    })
    .catch(() => "");
  cssTextCache.set(href, p);
  return p;
}

function rewriteWpCssForShadow(css: string): string {
  // Remove sourceMappingURL comments to avoid noisy /styles.css.map 404s.
  let out = css
    .replace(/\/\*#\s*sourceMappingURL=.*?\*\//g, "")
    .replace(/^\s*\/\/#\s*sourceMappingURL=.*$/gm, "");

  // Map global selectors to the shadow host.
  // Examples:
  //  body.page header#header  -> :host(.page) header#header
  //  body.show-menu header#header -> :host(.show-menu) header#header
  out = out
    .replace(/\bbody\.([a-zA-Z0-9_-]+)/g, ":host(.$1)")
    .replace(/\bbody\b/g, ":host")
    .replace(/\bhtml\[dir="rtl"\]/g, ":host([dir=\"rtl\"])")
    .replace(/\bhtml\b/g, ":host");

  return out;
}

function syncHostClasses(host: HTMLElement) {
  // Copy body classes (if any) for better parity.
  for (const c of document.body.classList) {
    host.classList.add(c);
  }
  // Ensure common WP templates apply (Next doesn't set these).
  host.classList.add("page");
}

export function WpShellShadow(props: {
  html: string;
  cssUrls: string[];
  kind: "header" | "footer";
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cssKey = useMemo(() => props.cssUrls.join("|"), [props.cssUrls]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    syncHostClasses(host);

    // Keep a stable mount point we can update.
    const mountId = "wp-shell-mount";
    let mount = root.getElementById(mountId) as HTMLDivElement | null;
    if (!mount) {
      mount = document.createElement("div");
      mount.id = mountId;
      root.appendChild(mount);
    }

    // Replace any previously injected styles.
    for (const el of Array.from(root.querySelectorAll("style[data-wp-css]"))) {
      el.remove();
    }

    // Update content.
    mount.innerHTML = props.html;

    // Load and inject full WP CSS (rewriting body selectors to :host for Shadow DOM).
    (async () => {
      const texts = await Promise.all(props.cssUrls.map((u) => (u ? getCssText(u) : Promise.resolve(""))));
      const combined = texts.filter(Boolean).join("\n");
      const rewritten = rewriteWpCssForShadow(combined);
      if (!rewritten.trim()) return;

      const style = document.createElement("style");
      style.setAttribute("data-wp-css", "1");
      style.textContent = rewritten;
      root.insertBefore(style, mount);
    })();

    if (props.kind === "header") {
      const ro = new ResizeObserver(() => {
        const h = mount.getBoundingClientRect().height;
        document.documentElement.style.setProperty("--wp-shell-header-height", `${Math.ceil(h)}px`);
      });
      ro.observe(mount);
      return () => ro.disconnect();
    }
  }, [props.html, cssKey, props.kind]);

  return <div ref={hostRef} />;
}

