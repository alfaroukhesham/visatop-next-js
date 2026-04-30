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
      function notifyParentLayout() {
        try { window.parent && window.parent.postMessage({ type: 'wp-shell:remeasure', kind: '${input.kind}' }, '*'); } catch (e) {}
      }

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

  const srcDoc = useMemo(
    () =>
      buildSrcDoc({
        html: props.html,
        cssUrls: props.cssUrls,
        kind: props.kind,
        baseHref: props.baseHref ?? null,
      }),
    [props.html, props.cssUrls, props.kind, props.baseHref]
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let ro: ResizeObserver | null = null;
    let raf = 0;

    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          const doc = iframe.contentDocument;
          if (!doc) return;

          // Prefer measuring the actual wp header/footer node if present.
          const target =
            (props.kind === "header"
              ? (doc.querySelector("header#header") as HTMLElement | null)
              : (doc.querySelector("footer#footer") as HTMLElement | null)) ?? doc.body;

          const rect = target.getBoundingClientRect();
          const baseHeight = Math.max(0, Math.ceil(rect.height));

          // If dropdowns are open, they often overflow the header's base height.
          // Expand the iframe so the dropdown isn't hidden behind app chrome.
          let expandedHeight = baseHeight;
          if (props.kind === "header") {
            const subs = Array.from(doc.querySelectorAll("header#header .sub-menu")) as HTMLElement[];
            for (const el of subs) {
              const cs = doc.defaultView?.getComputedStyle(el);
              if (!cs) continue;
              if (cs.display === "none" || cs.visibility === "hidden") continue;
              const opacity = Number.parseFloat(cs.opacity || "1");
              if (opacity <= 0) continue;
              const r = el.getBoundingClientRect();
              expandedHeight = Math.max(expandedHeight, Math.ceil(r.bottom));
            }
          }

          if (expandedHeight > 0) setHeightPx(expandedHeight);

          if (props.kind === "header" && baseHeight > 0) {
            document.documentElement.style.setProperty("--wp-shell-header-height", `${baseHeight}px`);
          }
        } catch {
          // ignore
        }
      });
    };

    const onLoad = () => {
      measure();
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        ro = new ResizeObserver(measure);
        ro.observe(doc.documentElement);
      } catch {
        // ignore
      }
    };

    iframe.addEventListener("load", onLoad);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as { type?: string; kind?: string } | null;
      if (data?.type === "wp-shell:remeasure" && data.kind === props.kind) {
        measure();
        window.setTimeout(measure, 220);
      }
    };
    window.addEventListener("message", onMessage);

    // In practice, srcDoc updates may not always trigger load; measure shortly after.
    const t = window.setTimeout(measure, 50);

    return () => {
      window.clearTimeout(t);
      iframe.removeEventListener("load", onLoad);
      window.removeEventListener("message", onMessage);
      if (ro) ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [props.kind, srcDoc]);

  return (
    <iframe
      ref={iframeRef}
      title={props.kind === "header" ? "WP Header" : "WP Footer"}
      srcDoc={srcDoc}
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

