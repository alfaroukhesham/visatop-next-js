"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const postMessageToken = useMemo(() => crypto.randomUUID(), []);

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
      const data = event.data as
        | { type?: string; kind?: string; height?: number; baseHeight?: number; token?: string }
        | null;
      if (data?.token !== postMessageToken) return;
      if (data?.type === "wp-shell:height" && data.kind === props.kind) {
        const h = Number(data.height);
        const baseH = Number(data.baseHeight);
        if (Number.isFinite(h) && h > 0) setHeightPx(h);
        if (props.kind === "header" && Number.isFinite(baseH) && baseH > 0) {
          document.documentElement.style.setProperty("--wp-shell-header-height", `${Math.ceil(baseH)}px`);
        }
      }
    };
    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [props.kind, srcDoc, postMessageToken]);

  return (
    <iframe
      ref={iframeRef}
      title={props.kind === "header" ? "WP Header" : "WP Footer"}
      srcDoc={srcDoc}
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

