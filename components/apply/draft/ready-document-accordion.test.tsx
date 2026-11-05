/** @vitest-environment jsdom */

import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CustomerI18nProvider } from "@/components/client/customer-i18n-provider";
import { getEnglishCustomerMessages } from "@/lib/i18n/load-customer-catalog";
import { PHOTO_SLOT } from "@/lib/apply/document-slot-catalog";
import { ReadyDocumentAccordion } from "./ready-document-accordion";

const en = getEnglishCustomerMessages();

const wrap = (ui: ReactElement) =>
  render(
    <CustomerI18nProvider locale="en" messages={en} fallback={en}>
      {ui}
    </CustomerI18nProvider>,
  );

afterEach(() => {
  cleanup();
});

describe("ReadyDocumentAccordion", () => {
  it("expands one row at a time and never treats names as wizard navigation", async () => {
    const user = userEvent.setup();
    wrap(
      <ReadyDocumentAccordion
        neededNow={[
          {
            key: "passport_copy",
            label: "Passport bio page (photo, or single-page PDF).",
            description: "JPEG, PNG, HEIC, or single-page PDF · 8MB max",
            icon: "passport",
          },
        ]}
        addLater={[
          {
            key: PHOTO_SLOT.key,
            label: "Personal photo",
            description: PHOTO_SLOT.description,
            icon: "photo",
            tip: "Takes about 2 minutes. Your phone camera works.",
          },
        ]}
      />,
    );

    const passport = screen.getByRole("button", { name: /passport bio page/i });
    const photo = screen.getByRole("button", { name: /personal photo/i });
    expect(passport).toHaveAttribute("aria-expanded", "true");
    expect(photo).toHaveAttribute("aria-expanded", "false");
    expect(passport.tagName).toBe("BUTTON");
    expect(getComputedStyle(passport).minHeight === "44px" || passport.className.includes("min-h-11")).toBe(
      true,
    );
    expect(passport.innerHTML).toMatch(/rtl:-scale-x-100/);

    await user.click(photo);
    expect(photo).toHaveAttribute("aria-expanded", "true");
    expect(passport).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/your phone camera works/i)).toBeInTheDocument();
    expect(screen.queryByText(/tip tbd/i)).not.toBeInTheDocument();

    await user.click(photo);
    expect(photo).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /passport bio page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /personal photo/i })).toBeInTheDocument();
    expect(document.querySelector("[data-apply-ready-docs]")).toBeTruthy();
  });
});
