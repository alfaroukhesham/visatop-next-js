"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useOnBfcacheRestore } from "@/lib/client/use-on-bfcache-restore";
import {
  buildCustomerLocaleSetCookieValue,
} from "@/lib/i18n/customer-locale";
import { classifyWpShellNavigateUrl } from "@/lib/wp-headless/classify-shell-navigate-url";
import type { WpShellLanguageOption } from "@/lib/wp-headless/types";

const APP_BASE_PATH = "/visa-processing";

interface ILanguageSwitcherConfig {
  current: string;
  available: WpShellLanguageOption[];
}

function stableShellToken(input: {
  kind: "header" | "footer";
  html: string;
  cssUrls: string[];
  hideLangSwitcher: boolean;
  languageSwitcher: ILanguageSwitcherConfig | null;
}): string {
  const switcherKey = input.languageSwitcher
    ? `${input.languageSwitcher.current}|${input.languageSwitcher.available.map((l) => l.slug).join(",")}`
    : "";
  const payload = [
    input.kind,
    input.hideLangSwitcher ? "1" : "0",
    switcherKey,
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LANG_SWITCHER_STYLES = `
      header#header nav.menu ul li.lang-switcher-item > a.lang-switcher-trigger {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 20px;
        white-space: nowrap;
        transition: border-color 0.2s linear, color 0.2s linear;
      }
      header#header nav.menu ul li.lang-switcher-item > a.lang-switcher-trigger:hover {
        border-color: #FCCD64;
        color: #FCCD64;
      }
      header#header nav.menu ul li.lang-switcher-item > a.lang-switcher-trigger:before,
      header#header nav.menu ul li.lang-switcher-item > a.lang-switcher-trigger:after {
        display: none !important;
        content: none !important;
      }
      header#header nav.menu .lang-globe {
        flex-shrink: 0;
        vertical-align: middle;
      }
      header#header nav.menu .lang-switcher-label {
        font-size: 14px;
        font-family: "Inter", sans-serif;
        font-weight: 400;
        line-height: 1;
      }
      header#header nav.menu ul li.lang-switcher-item .lang-sub-menu {
        width: 160px;
        min-width: 160px;
        columns: 1;
        column-gap: 0;
        padding: 16px 20px;
        left: 50%;
        transform: translateX(-50%);
      }
      header#header nav.menu ul li.lang-switcher-item .lang-sub-menu li {
        margin-bottom: 10px;
        break-inside: avoid;
      }
      header#header nav.menu ul li.lang-switcher-item .lang-sub-menu li:last-child {
        margin-bottom: 0;
      }
      header#header nav.menu ul li.lang-switcher-item .lang-sub-menu a {
        font-size: 14px;
        font-weight: 400;
        color: #224D64;
        padding: 0;
        display: block;
      }
      header#header nav.menu ul li.lang-switcher-item .lang-sub-menu a:hover {
        color: #CE8E00;
      }
      header#header nav.menu ul li.lang-switcher-item .lang-sub-menu a:after {
        display: none;
      }
      header#header nav.menu ul li.lang-switcher-item .lang-sub-menu .current-lang a {
        color: #CE8E00;
        font-weight: 600;
      }
      header#header nav.menu ul li.lang-switcher-item.open .lang-sub-menu {
        display: block;
        opacity: 1;
        visibility: visible;
      }
      @media screen and (max-width: 767px) {
        header#header nav.menu ul li.lang-switcher-item .lang-sub-menu {
          width: calc(100% + 40px);
          transform: unset;
          left: -20px;
        }
        header#header nav.menu ul li.lang-switcher-item > a.lang-switcher-trigger {
          border-color: rgba(255, 255, 255, 0.25);
        }
      }
`;

function buildInjectedLanguageSwitcherHtml(config: ILanguageSwitcherConfig): string {
  const current =
    config.available.find((item) => item.slug === config.current) ??
    config.available.find((item) => item.isCurrent) ??
    config.available[0];
  const currentLabel = escapeHtml(current?.name ?? config.current.toUpperCase());
  const items = config.available
    .map((item) => {
      const currentClass = item.slug === config.current ? " current-lang" : "";
      return `<li class="lang-item${currentClass}"><a href="#" data-vt-locale="${escapeHtml(item.slug)}">${escapeHtml(item.name)}</a></li>`;
    })
    .join("");
  return `<li class="lang-switcher-item menu-item menu-item-has-children" data-vt-injected-lang-switcher="1">
    <a href="#" class="lang-switcher-trigger" aria-haspopup="true" aria-expanded="false">
      <svg class="lang-globe" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"></circle>
        <path d="M3 12h18M12 3c2.5 2.8 2.5 14.2 0 18M12 3c-2.5 2.8-2.5 14.2 0 18" stroke="currentColor" stroke-width="1.5"></path>
      </svg>
      <span class="lang-switcher-label">${currentLabel}</span>
    </a>
    <ul class="lang-sub-menu sub-menu">${items}</ul>
  </li>`;
}

function buildSrcDoc(input: {
  html: string;
  cssUrls: string[];
  kind: "header" | "footer";
  baseHref: string | null;
  postMessageToken: string;
  hideLangSwitcher?: boolean;
  languageSwitcher?: ILanguageSwitcherConfig | null;
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
  const injectLangSwitcher =
    input.kind === "header" &&
    Boolean(input.languageSwitcher && input.languageSwitcher.available.length > 0);
  const injectedSwitcherHtml = injectLangSwitcher
    ? buildInjectedLanguageSwitcherHtml(input.languageSwitcher!)
    : "";

  // Ensure the iframe document has no default margins and doesn't scroll.
  // WP header is often position:fixed; we still measure its height explicitly from parent.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base ${baseHref ? `href="${escapeAttr(baseHref)}"` : ""} />
    ${links}
    <style>
      html, body { margin: 0; padding: 0; background: transparent !important; }
      body { overflow: hidden; }

      /* Fallback alignment: in WP this is handled by theme/plugin CSS, but our headless CSS
         bundle may omit those rules. This keeps "Time in UAE" pinned to the right. */
      header#header .featured_on .inner { display: flex; align-items: center; }
      header#header .featured_on .uae-time { margin-left: auto; }

      /* "Featured on" logos: WP theme constrains these; headless CSS path misses it. */
      header#header .featured_on .inner a img {
        height: 16px;
        width: auto;
        max-width: 100%;
        object-fit: contain;
        filter: brightness(0) invert(1);
      }

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

      ${
        input.hideLangSwitcher
          ? `
      /* Hide native Polylang / theme language UI; keep the injected Next switcher visible. */
      header#header nav.menu ul li.lang-switcher-item:not([data-vt-injected-lang-switcher]) {
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

      ${injectLangSwitcher ? LANG_SWITCHER_STYLES : ""}

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
      var INJECT_LANG_SWITCHER = ${injectLangSwitcher ? "true" : "false"};
      var INJECTED_LANG_SWITCHER_HTML = ${JSON.stringify(injectedSwitcherHtml)};

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

      function injectLanguageSwitcher() {
        if (!INJECT_LANG_SWITCHER || !INJECTED_LANG_SWITCHER_HTML) return;
        try {
          var nav = document.querySelector("header#header nav.menu ul");
          if (!nav || nav.querySelector("[data-vt-injected-lang-switcher]")) return;
          nav.insertAdjacentHTML("beforeend", INJECTED_LANG_SWITCHER_HTML);
        } catch (e) {}
      }

      function closeLangMenus(exceptLi) {
        try {
          var items = document.querySelectorAll("[data-vt-injected-lang-switcher]");
          for (var i = 0; i < items.length; i++) {
            if (exceptLi && items[i] === exceptLi) continue;
            items[i].classList.remove("open");
            var trigger = items[i].querySelector(".lang-switcher-trigger");
            if (trigger) trigger.setAttribute("aria-expanded", "false");
          }
        } catch (e) {}
      }

      injectLanguageSwitcher();
      document.addEventListener("DOMContentLoaded", injectLanguageSwitcher);

      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && document.body.classList.contains("show-menu")) {
          document.body.classList.remove("show-menu");
          notifyParentLayout();
        }
      });

      document.addEventListener("click", (e) => {
        const langTrigger =
          e.target && e.target.closest
            ? e.target.closest("[data-vt-injected-lang-switcher] > a.lang-switcher-trigger")
            : null;
        if (langTrigger) {
          e.preventDefault();
          e.stopPropagation();
          const li = langTrigger.closest("[data-vt-injected-lang-switcher]");
          if (!li) return;
          const willOpen = !li.classList.contains("open");
          closeLangMenus(willOpen ? li : null);
          li.classList.toggle("open", willOpen);
          langTrigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
          notifyParentLayout();
          return;
        }

        const langChoice =
          e.target && e.target.closest
            ? e.target.closest("[data-vt-injected-lang-switcher] a[data-vt-locale]")
            : null;
        if (langChoice) {
          e.preventDefault();
          e.stopPropagation();
          const slug = langChoice.getAttribute("data-vt-locale");
          if (slug) {
            post("wp-shell:locale", { slug: slug });
          }
          closeLangMenus(null);
          if (document.body.classList.contains("show-menu")) {
            document.body.classList.remove("show-menu");
            notifyParentLayout();
          }
          return;
        }

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

        if (!href || href.startsWith("#")) return;
        if (href === "#pll_switcher" || href.endsWith("#pll_switcher")) return;

        e.preventDefault();
        e.stopPropagation();

        if (document.body.classList.contains("show-menu")) {
          document.body.classList.remove("show-menu");
          notifyParentLayout();
        }

        post("wp-shell:navigate", { href: href });
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
  /** Injected lookalike switcher for Next locale (header only). */
  languageSwitcher?: ILanguageSwitcherConfig;
}) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const menuOpenRef = useRef(false);
  const lastGoodHeightRef = useRef<number>(props.kind === "header" ? 120 : 400);
  const [heightPx, setHeightPx] = useState<number>(props.kind === "header" ? 120 : 400);
  const languageSwitcher =
    props.kind === "header" && props.languageSwitcher ? props.languageSwitcher : null;
  const postMessageToken = useMemo(
    () =>
      stableShellToken({
        kind: props.kind,
        html: props.html,
        cssUrls: props.cssUrls,
        hideLangSwitcher: props.hideLangSwitcher === true,
        languageSwitcher,
      }),
    [props.html, props.cssUrls, props.kind, props.hideLangSwitcher, languageSwitcher],
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
        languageSwitcher,
      }),
    [
      props.html,
      props.cssUrls,
      props.kind,
      props.baseHref,
      postMessageToken,
      props.hideLangSwitcher,
      languageSwitcher,
    ],
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
        href?: unknown;
        slug?: unknown;
      };
      if (msg.token !== postMessageToken) return;
      if (msg.type === "wp-shell:locale" && typeof msg.slug === "string" && msg.slug.trim()) {
        const slug = msg.slug.trim().toLowerCase();
        document.cookie = buildCustomerLocaleSetCookieValue(slug);
        router.refresh();
        return;
      }
      if (msg.type === "wp-shell:navigate" && typeof msg.href === "string") {
        const { href } = msg;
        const appOrigin =
          typeof window !== "undefined" ? window.location.origin : "https://visatop.com";
        const target = classifyWpShellNavigateUrl({
          href,
          wpBaseHref: props.baseHref ?? null,
          appBasePath: APP_BASE_PATH,
          appOrigin,
        });
        if (target.mode === "internal") {
          router.push(target.path);
        } else {
          window.location.assign(target.url);
        }
        return;
      }
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
  }, [props.baseHref, props.kind, postMessageToken, router]);

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

