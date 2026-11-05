/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerI18nProvider } from "@/components/client/customer-i18n-provider";
import { getEnglishCustomerMessages } from "@/lib/i18n/load-customer-catalog";
import { buildWhatsAppUrl } from "@/lib/support-contact";
import type { ClientApplicationTracking } from "@/lib/applications/user-facing-tracking";

const gtagCommand = vi.fn();

vi.mock("@/lib/analytics/gtag-client", () => ({
  gtagCommand: (...args: unknown[]) => gtagCommand(...args),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { ApplicationTrackLookupForm } from "./application-track-lookup-form";

const en = getEnglishCustomerMessages();

const tracking: ClientApplicationTracking = {
  headline: "We're working on your application",
  detail: "Our team is processing your file.",
  steps: [
    { key: "prepare", label: "Prepare", state: "done" },
    { key: "payment", label: "Payment", state: "done" },
    { key: "processing", label: "Processing", state: "current" },
    { key: "outcome", label: "Outcome", state: "upcoming" },
  ],
};

const paidRow = {
  applicationId: "c4764b36-d624-4cd9-b40c-96665f06e8f5",
  referenceDisplay: "REF-1",
  nationalityCode: "IN",
  serviceId: "svc-1",
  serviceName: "Tourist Visa 30 days",
  nationalityName: "India",
  paymentStatus: "paid",
  clientTracking: tracking,
  canContinue: false,
  continueHref: null,
};

const unpaidContinueRow = {
  applicationId: "aaaaaaaa-bbbb-5ccc-dddd-eeeeeeeeeeee",
  referenceDisplay: "REF-2",
  nationalityCode: "IN",
  serviceId: "svc-1",
  serviceName: "Tourist Visa 30 days",
  nationalityName: "India",
  paymentStatus: "unpaid",
  clientTracking: tracking,
  canContinue: true,
  continueHref: "/apply/applications/aaaaaaaa-bbbb-5ccc-dddd-eeeeeeeeeeee",
};

const wrap = (ui: ReactElement) =>
  render(
    <CustomerI18nProvider locale="en" messages={en} fallback={en}>
      {ui}
    </CustomerI18nProvider>,
  );

const mockLookup = (applications: unknown[]) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { applications, nextCursor: null } }),
    }),
  );
};

describe("ApplicationTrackLookupForm paid guest actions", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    gtagCommand.mockReset();
  });

  beforeEach(() => {
    gtagCommand.mockReset();
  });

  it("replaces View status with a WhatsApp live-support link that includes the reference", async () => {
    mockLookup([paidRow]);
    const user = userEvent.setup();
    wrap(<ApplicationTrackLookupForm />);

    await user.type(screen.getByLabelText(/email, phone, or tracking id/i), "guest@example.com");
    await user.click(screen.getByRole("button", { name: /show applications/i }));

    await waitFor(() => {
      expect(screen.getByText("REF-1")).toBeInTheDocument();
    });

    expect(screen.queryByRole("link", { name: /view status/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", {
        name: /\/apply\/applications\/c4764b36-d624-4cd9-b40c-96665f06e8f5\/submitted/i,
      }),
    ).not.toBeInTheDocument();

    const support = screen.getByRole("link", { name: /speak with live support/i });
    const expectedHref = buildWhatsAppUrl(
      "Hi, I need help with my VisaTop application (ref REF-1).",
    );
    expect(support).toHaveAttribute("href", expectedHref);
    expect(support).toHaveAttribute("target", "_blank");
    expect(support).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(expectedHref).toContain("wa.me/971503156105");
    expect(expectedHref).toContain(encodeURIComponent("REF-1"));

    expect(screen.getByText("We're working on your application")).toBeInTheDocument();
  });

  it("fires the existing WhatsApp analytics event when live support is clicked", async () => {
    mockLookup([paidRow]);
    const user = userEvent.setup();
    wrap(<ApplicationTrackLookupForm />);

    await user.type(screen.getByLabelText(/email, phone, or tracking id/i), "guest@example.com");
    await user.click(screen.getByRole("button", { name: /show applications/i }));

    const support = await screen.findByRole("link", { name: /speak with live support/i });
    await user.click(support);

    expect(gtagCommand).toHaveBeenCalledWith("event", "whatsapp_lp_click", {
      event_category: "ads_lp",
      event_label: "chat_with_expert",
    });
  });

  it("still shows Continue for unpaid rows that the lookup marks as resumable", async () => {
    mockLookup([unpaidContinueRow]);
    const user = userEvent.setup();
    wrap(<ApplicationTrackLookupForm />);

    await user.type(screen.getByLabelText(/email, phone, or tracking id/i), "guest@example.com");
    await user.click(screen.getByRole("button", { name: /show applications/i }));

    const continueLink = await screen.findByRole("link", { name: /^continue$/i });
    expect(continueLink).toHaveAttribute(
      "href",
      "/apply/applications/aaaaaaaa-bbbb-5ccc-dddd-eeeeeeeeeeee",
    );
    expect(screen.queryByRole("link", { name: /speak with live support/i })).not.toBeInTheDocument();
  });
});
