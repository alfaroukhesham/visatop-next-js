/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { readViewportFooterTopPx, type IViewportBox } from "@/lib/client/combobox-list-position";

const viewport = (height = 844): IViewportBox => ({
  offsetTop: 0,
  offsetLeft: 0,
  width: 390,
  height,
  layoutHeight: height,
});

describe("readViewportFooterTopPx", () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.style.removeProperty("--wp-shell-footer-height");
  });

  it("returns the visual-viewport bottom when no footer chrome is present", () => {
    expect(readViewportFooterTopPx(viewport())).toBe(844);
  });

  it("reads a WP footer iframe sitting on the visual-viewport bottom", () => {
    const iframe = document.createElement("iframe");
    iframe.title = "WP Footer";
    iframe.setAttribute("data-wp-shell", "footer");
    iframe.style.cssText = "position:fixed;left:0;right:0;bottom:0;width:100%;height:400px;";
    document.body.appendChild(iframe);
    iframe.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 421,
        top: 421,
        left: 0,
        bottom: 821,
        right: 390,
        width: 390,
        height: 400,
        toJSON: () => ({}),
      }) as DOMRect;

    expect(readViewportFooterTopPx(viewport())).toBe(421);
  });

  it("ignores the WP header iframe pinned to the top", () => {
    const header = document.createElement("iframe");
    header.title = "WP Header";
    header.setAttribute("data-wp-shell", "header");
    header.style.cssText = "position:fixed;left:0;top:0;width:100%;height:117px;";
    document.body.appendChild(header);
    header.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 117,
        right: 390,
        width: 390,
        height: 117,
        toJSON: () => ({}),
      }) as DOMRect;

    expect(readViewportFooterTopPx(viewport())).toBe(844);
  });
});
