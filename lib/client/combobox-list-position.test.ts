import { describe, expect, it } from "vitest";
import {
  COMBOBOX_LIST_COLLISION_PADDING_PX,
  COMBOBOX_LIST_GAP_PX,
  COMBOBOX_LIST_MAX_HEIGHT_PX,
  COMBOBOX_LIST_MIN_HEIGHT_PX,
  COMBOBOX_LIST_VIEWPORT_TOP_PADDING_PX,
  comboboxScrollSpacerPx,
  comboboxScrollTopInsetPx,
  computeComboboxListPosition,
  scrollDeltaToVisualViewportTop,
  shouldPreferBelowList,
  type IAnchorRect,
  type IViewportBox,
} from "@/lib/client/combobox-list-position";

const rect = (overrides: Partial<IAnchorRect> & Pick<IAnchorRect, "top" | "left" | "bottom" | "width">): IAnchorRect => ({
  height: overrides.bottom - overrides.top,
  ...overrides,
});

const viewport = (overrides: Partial<IViewportBox> = {}): IViewportBox => ({
  offsetTop: 0,
  offsetLeft: 0,
  width: 390,
  height: 844,
  ...overrides,
});

const cssViewport = (vp: IViewportBox, subtractVisualOffset: boolean) => {
  if (subtractVisualOffset) {
    return { top: 0, left: 0, bottom: vp.height, right: vp.width };
  }
  return {
    top: vp.offsetTop,
    left: vp.offsetLeft,
    bottom: vp.offsetTop + vp.height,
    right: vp.offsetLeft + vp.width,
  };
};

const assertFullyInside = (
  pos: ReturnType<typeof computeComboboxListPosition>,
  vp: IViewportBox,
  subtractVisualOffset: boolean,
) => {
  const box = cssViewport(vp, subtractVisualOffset);
  const pad = COMBOBOX_LIST_COLLISION_PADDING_PX;
  expect(pos.top).toBeGreaterThanOrEqual(box.top + pad - 0.5);
  expect(pos.top + pos.maxHeight).toBeLessThanOrEqual(box.bottom - pad + 0.5);
  expect(pos.left).toBeGreaterThanOrEqual(box.left + pad - 0.5);
  expect(pos.left + pos.width).toBeLessThanOrEqual(box.right - pad + 0.5);
  expect(pos.maxHeight).toBeGreaterThan(0);
};

describe("shouldPreferBelowList", () => {
  it("prefers below on small / mobile widths", () => {
    expect(shouldPreferBelowList(360)).toBe(true);
    expect(shouldPreferBelowList(390)).toBe(true);
    expect(shouldPreferBelowList(767)).toBe(true);
  });

  it("allows flip on desktop widths", () => {
    expect(shouldPreferBelowList(768)).toBe(false);
    expect(shouldPreferBelowList(1280)).toBe(false);
  });
});

describe("comboboxScrollSpacerPx", () => {
  it("adds room to scroll the input above a keyboard-sized occlusion", () => {
    const px = comboboxScrollSpacerPx(
      viewport({ width: 360, height: 333, offsetTop: 0, layoutHeight: 640 }),
    );
    expect(px).toBeGreaterThanOrEqual(640);
    expect(px).toBeGreaterThan(COMBOBOX_LIST_MIN_HEIGHT_PX);
  });
});

describe("comboboxScrollTopInsetPx", () => {
  it("adds breathing room below a measured sticky header", () => {
    expect(comboboxScrollTopInsetPx(117)).toBe(117 + COMBOBOX_LIST_VIEWPORT_TOP_PADDING_PX);
  });

  it("still pads when the header offset is zero", () => {
    expect(comboboxScrollTopInsetPx(0)).toBe(COMBOBOX_LIST_VIEWPORT_TOP_PADDING_PX);
  });
});

describe("scrollDeltaToVisualViewportTop", () => {
  it("scrolls the anchor toward the top of the visual viewport", () => {
    expect(
      scrollDeltaToVisualViewportTop({
        anchorTop: 420,
        viewportOffsetTop: 80,
        padding: 12,
      }),
    ).toBe(328);
  });

  it("is zero when the anchor is already at the padding line", () => {
    expect(
      scrollDeltaToVisualViewportTop({
        anchorTop: 92,
        viewportOffsetTop: 80,
        padding: 12,
      }),
    ).toBe(0);
  });
});

describe("computeComboboxListPosition", () => {
  it("opens below the input when there is room", () => {
    const vp = viewport();
    const pos = computeComboboxListPosition({
      anchor: rect({ top: 120, bottom: 184, left: 16, width: 358 }),
      viewport: vp,
      preferBelow: true,
    });
    expect(pos.placement).toBe("below");
    expect(pos.top).toBe(184 + COMBOBOX_LIST_GAP_PX);
    expect(pos.left).toBe(16);
    expect(pos.width).toBe(358);
    expect(pos.maxHeight).toBeLessThanOrEqual(COMBOBOX_LIST_MAX_HEIGHT_PX);
    assertFullyInside(pos, vp, false);
  });

  it("keeps the list inside a keyboard-shrunk visual viewport and prefers below", () => {
    const vp = viewport({ width: 390, height: 400, offsetTop: 0 });
    const pos = computeComboboxListPosition({
      anchor: rect({ top: 72, bottom: 136, left: 16, width: 358 }),
      viewport: vp,
      preferBelow: true,
    });
    expect(pos.placement).toBe("below");
    expect(pos.top).toBe(136 + COMBOBOX_LIST_GAP_PX);
    expect(pos.maxHeight).toBeLessThanOrEqual(
      vp.height - (136 + COMBOBOX_LIST_GAP_PX) - COMBOBOX_LIST_COLLISION_PADDING_PX,
    );
    expect(pos.maxHeight).toBeLessThan(COMBOBOX_LIST_MAX_HEIGHT_PX);
    assertFullyInside(pos, vp, false);
  });

  it("does not use 100dvh-sized lists that would run under a reduced visual viewport", () => {
    const vp = viewport({ width: 360, height: 320, offsetTop: 0 });
    const pos = computeComboboxListPosition({
      anchor: rect({ top: 48, bottom: 112, left: 12, width: 336 }),
      viewport: vp,
      preferBelow: true,
    });
    expect(pos.maxHeight).toBeLessThanOrEqual(320);
    expect(pos.top + pos.maxHeight).toBeLessThanOrEqual(320 - COMBOBOX_LIST_COLLISION_PADDING_PX);
  });

  it("subtracts iOS visualViewport offset so position:fixed is not pinned to the layout top", () => {
    const vp = viewport({ width: 390, height: 400, offsetTop: 300, offsetLeft: 0 });
    const pos = computeComboboxListPosition({
      anchor: rect({ top: 360, bottom: 424, left: 16, width: 358 }),
      viewport: vp,
      preferBelow: true,
      subtractVisualOffset: true,
    });
    expect(pos.placement).toBe("below");
    expect(pos.top).toBe(424 - 300 + COMBOBOX_LIST_GAP_PX);
    expect(pos.top).toBeLessThan(400);
    expect(pos.top).toBeGreaterThan(0);
    assertFullyInside(pos, vp, true);
  });

  it("clamps a naive layout-bottom top into the visual viewport when offset is applied", () => {
    const vp = viewport({ width: 390, height: 360, offsetTop: 280 });
    const pos = computeComboboxListPosition({
      anchor: rect({ top: 300, bottom: 364, left: 8, width: 374 }),
      viewport: vp,
      preferBelow: true,
      subtractVisualOffset: true,
    });
    const naiveTop = 364 + COMBOBOX_LIST_GAP_PX;
    expect(naiveTop).toBeGreaterThan(360);
    expect(pos.top + pos.maxHeight).toBeLessThanOrEqual(360 - COMBOBOX_LIST_COLLISION_PADDING_PX);
    assertFullyInside(pos, vp, true);
  });

  it("flips above only when below is unusable and above has more room", () => {
    const vp = viewport({ width: 1280, height: 800, offsetTop: 0 });
    const pos = computeComboboxListPosition({
      anchor: rect({ top: 720, bottom: 780, left: 100, width: 320 }),
      viewport: vp,
      preferBelow: false,
    });
    expect(pos.placement).toBe("above");
    expect(pos.top + pos.maxHeight).toBeLessThanOrEqual(720 - COMBOBOX_LIST_GAP_PX + 0.5);
    assertFullyInside(pos, vp, false);
  });

  it("stays below on mobile even when space below is shorter than space above, as long as it is usable", () => {
    const vp = viewport({ width: 390, height: 500, offsetTop: 0 });
    const pos = computeComboboxListPosition({
      anchor: rect({ top: 280, bottom: 340, left: 16, width: 358 }),
      viewport: vp,
      preferBelow: true,
    });
    expect(pos.placement).toBe("below");
    expect(pos.top).toBe(340 + COMBOBOX_LIST_GAP_PX);
    expect(pos.maxHeight).toBeGreaterThanOrEqual(COMBOBOX_LIST_MIN_HEIGHT_PX);
    assertFullyInside(pos, vp, false);
  });

  it("stays attached below the input on mobile even when space below is tight", () => {
    const vp = viewport({ width: 390, height: 400, offsetTop: 0 });
    const pos = computeComboboxListPosition({
      anchor: rect({ top: 340, bottom: 390, left: 16, width: 358 }),
      viewport: vp,
      preferBelow: true,
    });
    expect(pos.placement).toBe("below");
    expect(pos.mode).toBe("inline");
    expect(pos.top).toBe(390 + COMBOBOX_LIST_GAP_PX);
    expect(pos.top).toBeGreaterThanOrEqual(390);
  });

  it("never overlaps the input when preferBelow", () => {
    const vp = viewport({ width: 360, height: 320, offsetTop: 0 });
    const pos = computeComboboxListPosition({
      anchor: rect({ top: 200, bottom: 280, left: 12, width: 336 }),
      viewport: vp,
      preferBelow: true,
    });
    expect(pos.top).toBeGreaterThanOrEqual(280 + COMBOBOX_LIST_GAP_PX - 0.5);
    expect(pos.placement).toBe("below");
  });

  it("does not park a short list at the visual-viewport bottom (that covers the heading)", () => {
    const vp = viewport({ width: 390, height: 400, offsetTop: 0, layoutHeight: 844 });
    const pos = computeComboboxListPosition({
      anchor: rect({ top: 360, bottom: 424, left: 16, width: 358 }),
      viewport: vp,
      preferBelow: true,
    });
    expect(pos.mode).toBe("inline");
    expect(pos.placement).toBe("below");
    expect(pos.top).toBe(424 + COMBOBOX_LIST_GAP_PX);
    expect(pos.top).toBeGreaterThan(360);
  });

  it("clamps horizontally so a wide list stays inside the visual viewport", () => {
    const vp = viewport({ width: 360, height: 640, offsetTop: 0 });
    const pos = computeComboboxListPosition({
      anchor: rect({ top: 80, bottom: 140, left: -20, width: 400 }),
      viewport: vp,
      preferBelow: true,
    });
    expect(pos.left).toBeGreaterThanOrEqual(COMBOBOX_LIST_COLLISION_PADDING_PX);
    expect(pos.left + pos.width).toBeLessThanOrEqual(360 - COMBOBOX_LIST_COLLISION_PADDING_PX);
    assertFullyInside(pos, vp, false);
  });

  it("clamps RTL physical left/width without depending on writing direction", () => {
    const vp = viewport({ width: 390, height: 844, offsetTop: 0 });
    const pos = computeComboboxListPosition({
      anchor: rect({ top: 200, bottom: 264, left: 20, width: 350 }),
      viewport: vp,
      preferBelow: true,
    });
    expect(pos.left).toBe(20);
    expect(pos.width).toBe(350);
    assertFullyInside(pos, vp, false);
  });
});
