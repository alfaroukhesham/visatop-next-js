export const COMBOBOX_LIST_GAP_PX = 8;
export const COMBOBOX_LIST_COLLISION_PADDING_PX = 8;
export const COMBOBOX_LIST_MIN_HEIGHT_PX = 96;
export const COMBOBOX_LIST_MAX_HEIGHT_PX = 22 * 16;
export const COMBOBOX_LIST_VIEWPORT_TOP_PADDING_PX = 12;
export const COMBOBOX_PREFER_BELOW_MAX_WIDTH_PX = 768;
export const WP_SHELL_HEADER_HEIGHT_VAR = "--wp-shell-header-height";

export interface IViewportBox {
  offsetTop: number;
  offsetLeft: number;
  width: number;
  height: number;
  /** Layout viewport height (`window.innerHeight`). Used to convert visual-bottom to CSS `bottom`. */
  layoutHeight?: number;
}

export interface IAnchorRect {
  top: number;
  left: number;
  bottom: number;
  width: number;
  height?: number;
}

export type TComboboxListPlacement = "below" | "above";

export type TComboboxListMode = "inline" | "attached";

export interface IComboboxListPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: TComboboxListPlacement;
  mode: TComboboxListMode;
}

export const COMBOBOX_SCROLL_SPACER_ATTR = "data-combobox-keyboard-spacer";

export const keyboardOcclusionPx = (viewport: IViewportBox): number => {
  const layoutHeight = viewport.layoutHeight ?? viewport.offsetTop + viewport.height;
  return Math.max(0, layoutHeight - viewport.height);
};

export const comboboxScrollSpacerPx = (viewport: IViewportBox): number => {
  const layoutHeight = viewport.layoutHeight ?? viewport.offsetTop + viewport.height;
  return (
    layoutHeight +
    COMBOBOX_LIST_MIN_HEIGHT_PX +
    COMBOBOX_LIST_GAP_PX +
    COMBOBOX_LIST_COLLISION_PADDING_PX * 2
  );
};

export const mountComboboxScrollSpacer = (heightPx: number): HTMLElement | null => {
  if (typeof document === "undefined") return null;
  document.querySelector(`[${COMBOBOX_SCROLL_SPACER_ATTR}]`)?.remove();
  const el = document.createElement("div");
  el.setAttribute(COMBOBOX_SCROLL_SPACER_ATTR, "");
  el.setAttribute("aria-hidden", "true");
  const px = Math.max(0, Math.round(heightPx));
  el.style.cssText = [
    "display:block",
    "width:100%",
    `height:${px}px`,
    "flex-shrink:0",
    "pointer-events:none",
    "overflow:hidden",
  ].join(";");
  document.body.appendChild(el);
  return el;
};

export const unmountComboboxScrollSpacer = (): void => {
  if (typeof document === "undefined") return;
  document.querySelector(`[${COMBOBOX_SCROLL_SPACER_ATTR}]`)?.remove();
};

export interface IComputeComboboxListPositionInput {
  anchor: IAnchorRect;
  viewport: IViewportBox;
  preferBelow?: boolean;
  /**
   * iOS Safari treats `position: fixed` as visual-viewport-relative when the
   * on-screen keyboard (or pinch-zoom) offsets `visualViewport`. Subtract the
   * offset so CSS `top`/`left` match that coordinate space.
   */
  subtractVisualOffset?: boolean;
}

export const shouldPreferBelowList = (viewportWidth: number): boolean =>
  viewportWidth < COMBOBOX_PREFER_BELOW_MAX_WIDTH_PX;

export const isVisualViewportRelativeFixedPosition = (
  userAgent: string,
  hasTouch = false,
): boolean => {
  if (/iP(?:ad|hone|od)/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && hasTouch;
};

export const readVisualViewportBox = (): IViewportBox => {
  if (typeof window === "undefined") {
    return { offsetTop: 0, offsetLeft: 0, width: 0, height: 0 };
  }
  const vv = window.visualViewport;
  if (vv) {
    return {
      offsetTop: vv.offsetTop,
      offsetLeft: vv.offsetLeft,
      width: vv.width,
      height: vv.height,
      layoutHeight: window.innerHeight,
    };
  }
  return {
    offsetTop: 0,
    offsetLeft: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    layoutHeight: window.innerHeight,
  };
};

export const comboboxScrollTopInsetPx = (headerOffsetPx: number): number =>
  Math.max(0, headerOffsetPx) + COMBOBOX_LIST_VIEWPORT_TOP_PADDING_PX;

export const readStickyHeaderOffsetPx = (): number => {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(WP_SHELL_HEADER_HEIGHT_VAR);
  const parsed = Number.parseFloat(raw);
  const fromVar = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  const vvTop = window.visualViewport?.offsetTop ?? 0;
  let measured = 0;
  const nodes = document.querySelectorAll("iframe, header");
  for (const node of nodes) {
    const el = node as HTMLElement;
    const pos = getComputedStyle(el).position;
    if (pos !== "fixed" && pos !== "sticky") continue;
    const r = el.getBoundingClientRect();
    if (r.height <= 0 || r.width <= 0) continue;
    if (r.top <= vvTop + 8 && r.bottom > vvTop) {
      measured = Math.max(measured, r.bottom - vvTop);
    }
  }
  return Math.max(fromVar, measured);
};

export const applyComboboxScrollMargin = (anchor: HTMLElement, insetPx: number): void => {
  anchor.style.scrollMarginTop = `${Math.max(0, Math.round(insetPx))}px`;
};

export const scrollDeltaToVisualViewportTop = ({
  anchorTop,
  viewportOffsetTop,
  padding = COMBOBOX_LIST_VIEWPORT_TOP_PADDING_PX,
}: {
  anchorTop: number;
  viewportOffsetTop: number;
  padding?: number;
}): number => anchorTop - viewportOffsetTop - padding;

export const scrollOverflowAncestors = (anchor: HTMLElement, deltaY: number): void => {
  if (typeof window === "undefined" || Math.abs(deltaY) < 1) return;
  let remaining = deltaY;
  let parent: HTMLElement | null = anchor.parentElement;
  while (parent && Math.abs(remaining) >= 1) {
    const maxScroll = parent.scrollHeight - parent.clientHeight;
    if (maxScroll > 1) {
      const before = parent.scrollTop;
      parent.scrollTop = before + remaining;
      remaining -= parent.scrollTop - before;
    }
    parent = parent.parentElement;
  }
  if (Math.abs(remaining) >= 1) {
    window.scrollBy({ top: remaining, left: 0, behavior: "instant" });
  }
};

export const scrollAnchorToVisualViewportTop = (anchor: HTMLElement): void => {
  const inset = comboboxScrollTopInsetPx(readStickyHeaderOffsetPx());
  applyComboboxScrollMargin(anchor, inset);
  const apply = (): void => {
    const viewport = readVisualViewportBox();
    const r = anchor.getBoundingClientRect();
    const delta = scrollDeltaToVisualViewportTop({
      anchorTop: r.top,
      viewportOffsetTop: viewport.offsetTop,
      padding: inset,
    });
    scrollOverflowAncestors(anchor, delta);
  };
  apply();
  const after = anchor.getBoundingClientRect();
  const remaining = scrollDeltaToVisualViewportTop({
    anchorTop: after.top,
    viewportOffsetTop: readVisualViewportBox().offsetTop,
    padding: inset,
  });
  if (Math.abs(remaining) >= 8) {
    scrollOverflowAncestors(anchor, remaining);
    if (typeof anchor.scrollIntoView === "function") {
      anchor.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
    }
  }
};

/**
 * Scroll a highlighted option inside the listbox without bubbling to the
 * window / visual viewport (iOS `scrollIntoView` can yank the page).
 */
export const scrollOptionIntoContainer = (option: HTMLElement, container: HTMLElement): void => {
  const c = container.getBoundingClientRect();
  const o = option.getBoundingClientRect();
  if (o.top < c.top) {
    container.scrollTop -= c.top - o.top;
  } else if (o.bottom > c.bottom) {
    container.scrollTop += o.bottom - c.bottom;
  }
};

export const subscribeViewportChange = (onChange: () => void): (() => void) => {
  window.addEventListener("scroll", onChange, true);
  window.addEventListener("resize", onChange);
  const vv = window.visualViewport;
  vv?.addEventListener("resize", onChange);
  vv?.addEventListener("scroll", onChange);
  return () => {
    window.removeEventListener("scroll", onChange, true);
    window.removeEventListener("resize", onChange);
    vv?.removeEventListener("resize", onChange);
    vv?.removeEventListener("scroll", onChange);
  };
};

const clamp = (value: number, min: number, max: number): number => {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
};

export const computeComboboxListPosition = ({
  anchor,
  viewport,
  preferBelow = true,
  subtractVisualOffset = false,
}: IComputeComboboxListPositionInput): IComboboxListPosition => {
  const originY = subtractVisualOffset ? viewport.offsetTop : 0;
  const originX = subtractVisualOffset ? viewport.offsetLeft : 0;
  const vpTop = subtractVisualOffset ? 0 : viewport.offsetTop;
  const vpLeft = subtractVisualOffset ? 0 : viewport.offsetLeft;
  const vpBottom = vpTop + viewport.height;
  const vpRight = vpLeft + viewport.width;
  const pad = COMBOBOX_LIST_COLLISION_PADDING_PX;
  const gap = COMBOBOX_LIST_GAP_PX;

  const anchorTop = anchor.top - originY;
  const anchorBottom = anchor.bottom - originY;
  const anchorLeft = anchor.left - originX;

  const spaceBelow = vpBottom - pad - (anchorBottom + gap);
  const spaceAbove = anchorTop - gap - (vpTop + pad);

  const placement: TComboboxListPlacement = preferBelow
    ? "below"
    : spaceBelow >= spaceAbove
      ? "below"
      : "above";

  let width = Math.min(anchor.width, Math.max(0, viewport.width - pad * 2));
  let left = anchorLeft;
  let maxHeight: number;
  let top: number;

  if (placement === "below") {
    // Never clamp `top` upward — that is what parked the list on top of the
    // input / the heading. Stay glued under the anchor and shrink height.
    top = anchorBottom + gap;
    maxHeight = Math.max(0, Math.min(COMBOBOX_LIST_MAX_HEIGHT_PX, vpBottom - pad - top));
  } else {
    maxHeight = Math.max(0, Math.min(COMBOBOX_LIST_MAX_HEIGHT_PX, spaceAbove));
    top = anchorTop - gap - maxHeight;
    const minTop = vpTop + pad;
    top = Math.max(minTop, top);
    maxHeight = Math.max(0, Math.min(maxHeight, anchorTop - gap - top));
  }

  const minLeft = vpLeft + pad;
  let maxLeft = vpRight - pad - width;
  if (maxLeft < minLeft) {
    width = Math.max(0, vpRight - pad - minLeft);
    maxLeft = minLeft;
  }
  left = clamp(left, minLeft, maxLeft);

  return {
    top,
    left,
    width,
    maxHeight,
    placement,
    mode: preferBelow ? "inline" : "attached",
  };
};
