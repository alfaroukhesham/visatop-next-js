"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useOnBfcacheRestore } from "@/lib/client/use-on-bfcache-restore";

function stableShellToken(input: {
  kind: "header" | "footer";
  html: string;
  cssUrls: string[];
  hideLangSwitcher: boolean;
}): string {
  const payload = [
    input.kind,
    input.hideLangSwitcher ? "1" : "0",
    input.cssUrls.join("|"),
    input.html,
  ].join("\0");
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `wp-shell-${input.kind}-${(hash >>> 0).toString(36)}`;
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
  hideLangSwitcher?: boolean;
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
      ${
        input.hideLangSwitcher
          ? `
      /* DISABLE_WP_LANG_SWITCHER: hide Polylang / theme language UI in the embedded shell */
      header#header nav.menu ul li.lang-switcher-item {
        display: none !important;
      }
      @supports selector(header#header nav.menu li:has(a[href="#pll_switcher"])) {
        header#header nav.menu li:has(a[href="#pll_switcher"]) {
          display: none !important;
        }
      }
      footer#footer .footer-lang-dropdown {
        display: none !important;
      }
      `
          : ""
      }

      /* Mobile drawer: theme JS is not bundled in headless shell — replicate drawer + hamburger up to tablet width */
      @media screen and (max-width: 991px) {
        header#header .mobile_menu {
          display: block;
          cursor: pointer;
          touch-action: manipulation;
        }
        header#header nav.menu {
          position: fixed;
          top: 0;
          right: -280px;
          left: auto;
          width: 280px;
          height: 100vh;
          height: 100dvh;
          max-height: -webkit-fill-available;
          background: #012031;
          padding: 80px 35px 40px;
          align-items: flex-start;
          z-index: 101;
          transition: right 0.2s linear;
          overflow-x: hidden;
        }
        header#header nav.menu ul {
          flex-direction: column;
          align-items: flex-start;
          width: 100%;
        }
        header#header nav.menu ul > li + li {
          margin-top: 25px;
        }
        @supports (gap: 1px) {
          header#header nav.menu ul {
            gap: 25px;
          }
          header#header nav.menu ul > li + li {
            margin-top: 0;
          }
        }
        header#header nav.menu ul li {
          width: 100%;
        }
        header#header nav.menu ul li.menu-item-has-children.open .sub-menu {
          display: block;
          opacity: 1;
          visibility: visible;
        }
        body.show-menu {
          overflow: hidden;
        }
        body.show-menu header#header:before {
          content: "";
          position: fixed;
          top: 0;
          left: 0;
          display: block;
          width: 100%;
          height: 100%;
          background-color: #012031;
          opacity: 0.75;
          z-index: 100;
        }
        body.show-menu header#header .mobile_menu {
          border-top-color: transparent;
        }
        body.show-menu header#header .mobile_menu:before {
          top: 12px;
          transform: rotate(45deg);
        }
        body.show-menu header#header .mobile_menu:after {
          bottom: 11px;
          transform: rotate(-45deg);
        }
        body.show-menu header#header nav.menu {
          right: 0;
        }
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

      function measureTargetHeight(target) {
        var rect = target.getBoundingClientRect();
        var height = Math.max(0, Math.ceil(rect.height));
        if (height > 0) return height;
        if (KIND !== "header") return height;
        var container = document.querySelector("header#header > .container");
        var featured = document.querySelector("header#header .featured_on");
        var maxBottom = 0;
        if (container && container.getBoundingClientRect) {
          maxBottom = Math.max(maxBottom, Math.ceil(container.getBoundingClientRect().bottom));
        }
        if (featured && featured.getBoundingClientRect) {
          maxBottom = Math.max(maxBottom, Math.ceil(featured.getBoundingClientRect().bottom));
        }
        return maxBottom;
      }

      function measureAndPost() {
        try {
          var target = pickTarget();
          if (!target) return;
          var baseHeight = measureTargetHeight(target);
          var expandedHeight = baseHeight;
          var menuOpen = KIND === "header" && document.body.classList.contains("show-menu");

          if (KIND === "header") {
            var subs = Array.prototype.slice.call(document.querySelectorAll("header#header .sub-menu"));
            for (var i = 0; i < subs.length; i++) {
              var el = subs[i];
              if (!el || !el.getBoundingClientRect) continue;
              var cs = window.getComputedStyle(el);
              if (!cs) continue;
              if (cs.display === "none" || cs.visibility === "hidden") continue;
              var opacity = parseFloat(cs.opacity || "1");
              if (opacity <= 0) continue;
              var r = el.getBoundingClientRect();
              expandedHeight = Math.max(expandedHeight, Math.ceil(r.bottom));
            }
          }

          post("wp-shell:height", {
            height: expandedHeight,
            baseHeight: baseHeight,
            menuOpen: menuOpen,
          });

          if (baseHeight === 0) {
            requestAnimationFrame(function () {
              requestAnimationFrame(measureAndPost);
            });
          }
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
        window.addEventListener("load", function () { measureAndPost(); });
        document.addEventListener("DOMContentLoaded", function () { measureAndPost(); });
      } catch (e) {}

      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && document.body.classList.contains("show-menu")) {
          document.body.classList.remove("show-menu");
          notifyParentLayout();
        }
      });

      document.addEventListener("click", (e) => {
        const mobileBtn =
          e.target && e.target.closest
            ? e.target.closest("header#header .mobile_menu, header#header button.mobile_menu")
            : null;
        if (mobileBtn) {
          e.preventDefault();
          document.body.classList.toggle("show-menu");
          notifyParentLayout();
          setTimeout(notifyParentLayout, 220);
          return;
        }

        if (document.body.classList.contains("show-menu") && KIND === "header") {
          const nav = document.querySelector("header#header nav.menu");
          const onBackdrop =
            e.target &&
            e.target.closest &&
            e.target.closest("header#header") &&
            !(nav && nav.contains(e.target)) &&
            !e.target.closest("header#header .mobile_menu");
          if (onBackdrop) {
            document.body.classList.remove("show-menu");
            notifyParentLayout();
            return;
          }
        }

        const a = e.target && e.target.closest ? e.target.closest("a") : null;
        if (!a) return;
        const href = a.getAttribute("href");
        const li = a.closest ? a.closest("li") : null;

        // Dropdown behavior for parent menu items.
        // WP header markup usually uses: li.menu-item-has-children > a[href="#"] + ul.sub-menu
        if (li && li.classList && li.classList.contains("menu-item-has-children")) {
          const isToggleHref =
            !href ||
            href === "#" ||
            href === "/#" ||
            href.endsWith("/#") ||
            href.startsWith("#");

          if (isToggleHref) {
            e.preventDefault();
            e.stopPropagation();

            // Close sibling dropdowns for cleaner UX.
            const parentUl = li.parentElement;
            if (parentUl) {
              for (const sib of parentUl.children) {
                if (sib !== li && sib.classList) sib.classList.remove("open");
              }
            }

            li.classList.toggle("open");
            // Absolutely-positioned submenus don't resize the document, so ask parent to remeasure.
            notifyParentLayout();
            setTimeout(notifyParentLayout, 220);
            return;
          }
        }

        // Normal links: do not intercept. The injected <base target="_blank"> makes the browser open
        // the same way as right-click Open link in new tab (avoids sandboxed window.open).
        if (!href || href.startsWith("#")) return;

        if (document.body.classList.contains("show-menu")) {
          document.body.classList.remove("show-menu");
          notifyParentLayout();
        }
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
  /** When true, hides WP header/footer language controls (see DISABLE_WP_LANG_SWITCHER). */
  hideLangSwitcher?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const menuOpenRef = useRef(false);
  const lastGoodHeightRef = useRef<number>(props.kind === "header" ? 120 : 400);
  const [heightPx, setHeightPx] = useState<number>(props.kind === "header" ? 120 : 400);
  const postMessageToken = useMemo(
    () =>
      stableShellToken({
        kind: props.kind,
        html: props.html,
        cssUrls: props.cssUrls,
        hideLangSwitcher: props.hideLangSwitcher === true,
      }),
    [props.html, props.cssUrls, props.kind, props.hideLangSwitcher],
  );

  const srcDoc = useMemo(
    () =>
      buildSrcDoc({
        html: props.html,
        cssUrls: props.cssUrls,
        kind: props.kind,
        baseHref: props.baseHref ?? null,
        postMessageToken,
        hideLangSwitcher: props.hideLangSwitcher === true,
      }),
    [props.html, props.cssUrls, props.kind, props.baseHref, postMessageToken, props.hideLangSwitcher]
  );

  const assignIframeSrcDoc = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = srcDoc;
  }, [srcDoc]);

  useOnBfcacheRestore(assignIframeSrcDoc);

  useLayoutEffect(() => {
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
        menuOpen?: unknown;
      };
      if (msg.token !== postMessageToken) return;
      if (msg.type === "wp-shell:height" && msg.kind === props.kind) {
        const h = Number(msg.height);
        const baseH = Number(msg.baseHeight);
        const menuOpen = msg.menuOpen === true;
        menuOpenRef.current = menuOpen && props.kind === "header";
        const viewportH =
          typeof window !== "undefined"
            ? window.visualViewport?.height ??
              window.innerHeight ??
              document.documentElement.clientHeight ??
              0
            : 0;
        if (menuOpen && props.kind === "header" && viewportH > 0) {
          setHeightPx(viewportH);
        } else if (Number.isFinite(h) && h > 0) {
          lastGoodHeightRef.current = h;
          setHeightPx(h);
        }
        if (props.kind === "header" && Number.isFinite(baseH) && baseH > 0) {
          lastGoodHeightRef.current = Math.max(lastGoodHeightRef.current, baseH);
          document.documentElement.style.setProperty("--wp-shell-header-height", `${Math.ceil(baseH)}px`);
        } else if (props.kind === "header" && lastGoodHeightRef.current > 0) {
          document.documentElement.style.setProperty(
            "--wp-shell-header-height",
            `${Math.ceil(lastGoodHeightRef.current)}px`,
          );
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [props.kind, postMessageToken]);

  useEffect(() => {
    if (props.kind !== "header") return;
    const onResize = () => {
      if (menuOpenRef.current) {
        const viewportH =
          window.visualViewport?.height ??
          window.innerHeight ??
          document.documentElement.clientHeight ??
          0;
        setHeightPx(viewportH);
      }
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [props.kind]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      assignIframeSrcDoc();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [assignIframeSrcDoc]);

  return (
    <iframe
      ref={iframeRef}
      title={props.kind === "header" ? "WP Header" : "WP Footer"}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
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

