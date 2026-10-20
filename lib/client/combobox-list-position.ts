export const COMBOBOX_LIST_GAP_PX = 8;
export const COMBOBOX_LIST_COLLISION_PADDING_PX = 8;
export const COMBOBOX_LIST_MIN_HEIGHT_PX = 96;
export const COMBOBOX_LIST_MAX_HEIGHT_PX = 22 * 16;
export const COMBOBOX_LIST_VIEWPORT_TOP_PADDING_PX = 12;
export const COMBOBOX_PREFER_BELOW_MAX_WIDTH_PX = 768;

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

export type TComboboxListMode = "attached" | "sheet";

export interface IComboboxListPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  /** Sheet frame height (visual viewport minus padding). Only for `mode: "sheet"`. */
  height?: number;
  placement: TComboboxListPlacement;
  mode: TComboboxListMode;
}

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

export const scrollDeltaToVisualViewportTop = ({
  anchorTop,
  viewportOffsetTop,
  padding = COMBOBOX_LIST_VIEWPORT_TOP_PADDING_PX,
}: {
  anchorTop: number;
  viewportOffsetTop: number;
  padding?: number;
}): number => anchorTop - viewportOffsetTop - padding;

export const scrollAnchorToVisualViewportTop = (anchor: HTMLElement): void => {
  const viewport = readVisualViewportBox();
  const r = anchor.getBoundingClientRect();
  const delta = scrollDeltaToVisualViewportTop({
    anchorTop: r.top,
    viewportOffsetTop: viewport.offsetTop,
  });
  if (Math.abs(delta) >= 1) {
    window.scrollBy({ top: delta, left: 0, behavior: "instant" });
  }
  const after = anchor.getBoundingClientRect();
  const remaining = scrollDeltaToVisualViewportTop({
    anchorTop: after.top,
    viewportOffsetTop: readVisualViewportBox().offsetTop,
  });
  if (Math.abs(remaining) >= 8 && typeof anchor.scrollIntoView === "function") {
    anchor.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
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

  let placement: TComboboxListPlacement;
  let pinToViewportBottom = false;
  if (preferBelow) {
    placement = "below";
    pinToViewportBottom = spaceBelow < COMBOBOX_LIST_MIN_HEIGHT_PX;
  } else {
    placement = spaceBelow >= spaceAbove ? "below" : "above";
  }

  let width = Math.min(anchor.width, Math.max(0, viewport.width - pad * 2));
  let left = anchorLeft;
  let maxHeight: number;
  let top: number;

  if (pinToViewportBottom) {
    const originYSheet = subtractVisualOffset ? viewport.offsetTop : 0;
    maxHeight = Math.max(
      0,
      Math.min(COMBOBOX_LIST_MAX_HEIGHT_PX, viewport.height * 0.45, viewport.height - pad * 2),
    );
    const frameTop = viewport.offsetTop + pad - originYSheet;
    const frameHeight = Math.max(0, viewport.height - pad * 2);
    width = Math.max(0, viewport.width - pad * 2);
    left = vpLeft + pad;
    const minLeft = vpLeft + pad;
    let maxLeft = vpRight - pad - width;
    if (maxLeft < minLeft) {
      width = Math.max(0, vpRight - pad - minLeft);
      maxLeft = minLeft;
    }
    left = clamp(left, minLeft, maxLeft);
    return {
      top: frameTop,
      left,
      width,
      maxHeight,
      height: frameHeight,
      placement,
      mode: "sheet",
    };
  } else if (placement === "below") {
    maxHeight = Math.max(0, Math.min(COMBOBOX_LIST_MAX_HEIGHT_PX, spaceBelow));
    top = anchorBottom + gap;
  } else {
    maxHeight = Math.max(0, Math.min(COMBOBOX_LIST_MAX_HEIGHT_PX, spaceAbove));
    top = anchorTop - gap - maxHeight;
  }

  if (maxHeight <= 0) {
    maxHeight = Math.max(0, viewport.height - pad * 2);
    top = vpTop + pad;
  }

  const minTop = vpTop + pad;
  let maxTop = vpBottom - pad - maxHeight;
  if (maxTop < minTop) {
    maxHeight = Math.max(0, vpBottom - pad - minTop);
    maxTop = vpBottom - pad - maxHeight;
  }
  top = clamp(top, minTop, maxTop);

  const minLeft = vpLeft + pad;
  let maxLeft = vpRight - pad - width;
  if (maxLeft < minLeft) {
    width = Math.max(0, vpRight - pad - minLeft);
    maxLeft = minLeft;
  }
  left = clamp(left, minLeft, maxLeft);

  return { top, left, width, maxHeight, placement, mode: "attached" };
};
