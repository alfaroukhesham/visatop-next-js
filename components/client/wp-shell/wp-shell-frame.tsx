"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function safeRandomUUID(): string {
  const c = globalThis.crypto as
    | (Crypto & { randomUUID?: () => string })
    | undefined;

  if (typeof c?.randomUUID === "function") return c.randomUUID();

  const getRandomValues = c?.getRandomValues?.bind(c);
  if (getRandomValues) {
    const bytes = new Uint8Array(16);
    getRandomValues(bytes);
    // RFC 4122 v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
      .slice(6, 8)
      .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  // Last resort (non-cryptographic)
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}

function buildSrcDoc(input: {
  html: string;
  cssUrls: string[];
  kind: "header" | "footer";
  baseHref: string | null;
  postMessageToken: string;
}): string {
  const links = input.cssUrls
    .filter(Boolean)
    .map((href) => `<link rel="stylesheet" href="${escapeAttr(href)}">`)
    .join("\n");

  const baseHref = input.baseHref
    ? input.baseHref.endsWith("/")
      ? input.baseHref
      : `${input.baseHref}/`
    : null;

  // Force WP page-like selectors to apply.
  const bodyClass = "page";

  // Ensure the iframe document has no default margins and doesn't scroll.
  // WP header is often position:fixed; we still measure its height explicitly from parent.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base ${baseHref ? `href="${escapeAttr(baseHref)}"` : ""} target="_blank" />
    ${links}
    <style>
      html, body { margin: 0; padding: 0; background: transparent !important; }
      body { overflow: hidden; }

      /* Fallback alignment: in WP this is handled by theme/plugin CSS, but our headless CSS
         bundle may omit those rules. This keeps "Time in UAE" pinned to the right. */
      header#header .featured_on .inner { display: flex; align-items: center; }
      header#header .featured_on .uae-time { margin-left: auto; }

      /* Polylang language switcher (headless markup differs on prod: href="#pll_switcher" with no class). */
      header#header nav.menu a[href="#pll_switcher"] {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 20px;
        white-space: nowrap;
        transition: border-color 0.2s linear, color 0.2s linear;
      }
      header#header nav.menu a[href="#pll_switcher"]:hover {
        border-color: #FCCD64;
        color: #FCCD64;
      }
      header#header nav.menu a[href="#pll_switcher"]::before,
      header#header nav.menu a[href="#pll_switcher"]::after {
        display: none !important;
        content: none !important;
      }

      /* "Featured on" logos: WP theme constrains these; headless CSS path misses it. */
      header#header .featured_on .inner a img {
        height: 16px;
        width: auto;
        max-width: 100%;
        object-fit: contain;
        filter: brightness(0) invert(1);
      }
    </style>
  </head>
  <body class="${bodyClass}">
    ${input.html}
    <script>
      var WP_SHELL_TOKEN = ${JSON.stringify(input.postMessageToken)};
      var KIND = ${JSON.stringify(input.kind)};

      function post(type, payload) {
        try {
          if (!window.parent) return;
          window.parent.postMessage(Object.assign({ type: type, kind: KIND, token: WP_SHELL_TOKEN }, payload || {}), '*');
        } catch (e) {}
      }

      function pickTarget() {
        try {
          var doc = document;
          if (KIND === 'header') return doc.querySelector('header#header') || doc.body;
          if (KIND === 'footer') return doc.querySelector('footer#footer') || doc.body;
          return doc.body;
        } catch (e) {
          return document.body;
        }
      }

      function measureAndPost() {
        try {
          var target = pickTarget();
          if (!target) return;
          var rect = target.getBoundingClientRect();
          var baseHeight = Math.max(0, Math.ceil(rect.height));
          var expandedHeight = baseHeight;

          if (KIND === 'header') {
            var subs = Array.prototype.slice.call(document.querySelectorAll('header#header .sub-menu'));
            for (var i = 0; i < subs.length; i++) {
              var el = subs[i];
              if (!el || !el.getBoundingClientRect) continue;
              var cs = window.getComputedStyle(el);
              if (!cs) continue;
              if (cs.display === 'none' || cs.visibility === 'hidden') continue;
              var opacity = parseFloat(cs.opacity || '1');
              if (opacity <= 0) continue;
              var r = el.getBoundingClientRect();
              expandedHeight = Math.max(expandedHeight, Math.ceil(r.bottom));
            }
          }

          post('wp-shell:height', { height: expandedHeight, baseHeight: baseHeight });
        } catch (e) {}
      }

      function notifyParentLayout() {
        measureAndPost();
        setTimeout(measureAndPost, 220);
      }

      try {
        var ro = new ResizeObserver(function () { measureAndPost(); });
        ro.observe(document.documentElement);
      } catch (e) {}

      try {
        window.addEventListener('load', function () { measureAndPost(); });
        document.addEventListener('DOMContentLoaded', function () { measureAndPost(); });
      } catch (e) {}

      document.addEventListener('click', (e) => {
        const a = e.target && e.target.closest ? e.target.closest('a') : null;
        if (!a) return;
        const href = a.getAttribute('href');
        const li = a.closest ? a.closest('li') : null;

        // Dropdown behavior for parent menu items.
        // WP header markup usually uses: li.menu-item-has-children > a[href="#"] + ul.sub-menu
        if (li && li.classList && li.classList.contains('menu-item-has-children')) {
          const isToggleHref =
            !href ||
            href === '#' ||
            href === '/#' ||
            href.endsWith('/#') ||
            href.startsWith('#');

          if (isToggleHref) {
            e.preventDefault();
            e.stopPropagation();

            // Close sibling dropdowns for cleaner UX.
            const parentUl = li.parentElement;
            if (parentUl) {
              for (const sib of parentUl.children) {
                if (sib !== li && sib.classList) sib.classList.remove('open');
              }
            }

            li.classList.toggle('open');
            // Absolutely-positioned submenus don't resize the document, so ask parent to remeasure.
            notifyParentLayout();
            setTimeout(notifyParentLayout, 220);
            return;
          }
        }

        // Normal links open in a new tab (user preference).
        if (!href || href.startsWith('#')) return;
        e.preventDefault();
        window.open(a.href, '_blank', 'noopener,noreferrer');
      }, true);
    </script>
  </body>
</html>`;
}

export function WpShellFrame(props: {
  html: string;
  cssUrls: string[];
  kind: "header" | "footer";
  baseHref?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [heightPx, setHeightPx] = useState<number>(props.kind === "header" ? 120 : 400);
  const postMessageToken = useMemo(() => safeRandomUUID(), []);

  const srcDoc = useMemo(
    () =>
      buildSrcDoc({
        html: props.html,
        cssUrls: props.cssUrls,
        kind: props.kind,
        baseHref: props.baseHref ?? null,
        postMessageToken,
      }),
    [props.html, props.cssUrls, props.kind, props.baseHref, postMessageToken]
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const data: unknown = event.data;
      if (typeof data !== "object" || data === null) return;
      const msg = data as {
        token?: unknown;
        type?: unknown;
        kind?: unknown;
        height?: unknown;
        baseHeight?: unknown;
      };
      if (msg.token !== postMessageToken) return;
      if (msg.type === "wp-shell:height" && msg.kind === props.kind) {
        const h = Number(msg.height);
        const baseH = Number(msg.baseHeight);
        if (Number.isFinite(h) && h > 0) setHeightPx(h);
        if (props.kind === "header" && Number.isFinite(baseH) && baseH > 0) {
          document.documentElement.style.setProperty("--wp-shell-header-height", `${Math.ceil(baseH)}px`);
        }
      }
    };
    window.addEventListener("message", onMessage);
    // Ensure we attach `message` listener BEFORE the iframe loads `srcDoc`.
    // Otherwise, early `postMessage` events (ready/height) can be missed.
    iframe.srcdoc = srcDoc;

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [props.kind, srcDoc, postMessageToken, props.baseHref, props.cssUrls, props.html]);

  return (
    <iframe
      ref={iframeRef}
      title={props.kind === "header" ? "WP Header" : "WP Footer"}
      srcDoc=""
      sandbox="allow-scripts allow-popups"
      style={{
        width: "100%",
        height: `${heightPx}px`,
        border: "0",
        display: "block",
        background: "transparent",
        ...(props.kind === "header"
          ? {
              position: "fixed",
              top: 0,
              left: 0,
              // Intentionally extreme to beat app stacking contexts (dialogs, sticky bars, etc).
              zIndex: 2147483647,
            }
          : null),
      }}
      scrolling="no"
    />
  );
}

