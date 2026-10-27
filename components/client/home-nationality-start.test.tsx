/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerI18nProvider } from "@/components/client/customer-i18n-provider";
import { getEnglishCustomerMessages } from "@/lib/i18n/load-customer-catalog";
import {
  COMPACT_VIEWPORT_MEDIA_QUERY,
  NARROW_VIEWPORT_MEDIA_QUERY,
} from "@/lib/client/use-narrow-viewport";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { HomeNationalityStart } from "./home-nationality-start";

const en = getEnglishCustomerMessages();

const installMatchMedia = (opts: { narrow?: boolean; compact?: boolean } | boolean) => {
  const narrow = typeof opts === "boolean" ? opts : Boolean(opts.narrow);
  const compact = typeof opts === "boolean" ? false : Boolean(opts.compact);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) =>
      ({
        matches:
          query === COMPACT_VIEWPORT_MEDIA_QUERY
            ? compact
            : query === NARROW_VIEWPORT_MEDIA_QUERY
              ? narrow
              : false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => true,
      }) as MediaQueryList,
  });
};

const wrap = (ui: ReactElement) =>
  render(
    <CustomerI18nProvider locale="en" messages={en} fallback={en}>
      {ui}
    </CustomerI18nProvider>,
  );

describe("HomeNationalityStart", () => {
  beforeEach(() => {
    installMatchMedia(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: { nationalities: [{ code: "IN", name: "India" }] },
          meta: { requestId: "home-nationality-test" },
        }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the full passport placeholder at desktop widths", async () => {
    wrap(<HomeNationalityStart />);
    const input = await screen.findByRole("combobox");
    expect(input).toHaveAttribute("placeholder", "Select your Passport nationality");
  });

  it("uses the short passport placeholder only at max-width 414px", async () => {
    installMatchMedia({ narrow: true, compact: false });
    wrap(<HomeNationalityStart />);
    const input = await screen.findByRole("combobox");
    expect(input).toHaveAttribute("placeholder", "Your passport");
  });

  it("uses the one-word passport placeholder at max-width 240px", async () => {
    installMatchMedia({ narrow: true, compact: true });
    wrap(<HomeNationalityStart />);
    const input = await screen.findByRole("combobox");
    expect(input).toHaveAttribute("placeholder", "Passport");
  });

  it("scopes NEXT width overrides to max-[414px] without dropping the desktop min-width", async () => {
    wrap(<HomeNationalityStart />);
    const next = await waitFor(() => screen.getByRole("button", { name: "Next" }));
    expect(next.className).toContain("min-w-[148px]");
    expect(next.className).toContain("max-[414px]:min-w-0");
    expect(next.className).toContain("max-[414px]:max-w-full");
    expect(next.className).toContain("max-[414px]:w-full");
  });
});
