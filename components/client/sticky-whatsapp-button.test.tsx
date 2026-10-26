/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support-contact";

const usePathname = vi.fn(() => "/portal");

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

import { StickyWhatsAppButton } from "./sticky-whatsapp-button";

describe("StickyWhatsAppButton", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/portal");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the floating button outside the tourist visa flow", () => {
    for (const path of ["/portal", "/apply/track", "/speak-with-an-expert", "/sign-in"]) {
      usePathname.mockReturnValue(path);
      const { unmount } = render(<StickyWhatsAppButton label="WhatsApp support" />);
      const link = screen.getByRole("link", { name: "WhatsApp support" });
      expect(link).toHaveAttribute("href", SUPPORT_WHATSAPP_URL);
      unmount();
    }
  });

  it("hides the floating button on tourist visa flow steps, including checkout", () => {
    for (const path of ["/", "/apply/start", "/apply/applications/app_1", "/apply/applications/app_1/payment"]) {
      usePathname.mockReturnValue(path);
      const { unmount } = render(<StickyWhatsAppButton label="WhatsApp support" />);
      expect(screen.queryByRole("link", { name: "WhatsApp support" })).toBeNull();
      unmount();
    }
  });
});
