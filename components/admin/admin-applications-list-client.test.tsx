/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const listState = {
  appliedFilters: {
    q: "",
    status: "",
    payment: "",
    fulfillment: "",
    attention: false,
  },
  applyFilters: vi.fn(),
  page: 0,
  setPage: vi.fn(),
  pageSize: 20,
  onPageSizeChange: vi.fn(),
  items: [
    {
      id: "app_fincra_unpaid",
      serviceId: "svc_1",
      serviceName: "30 Days Tourist Visa",
      applicationStatus: "ready_for_payment",
      paymentStatus: "checkout_created",
      fulfillmentStatus: "not_started",
      referenceNumber: "VT-1001",
      fullName: "Ada Okonkwo",
      guestEmail: "ada@example.com",
      adminAttentionRequired: false,
      createdAt: "2026-11-05T07:00:00.000Z",
      partyId: null,
      travelerKind: "adult",
      partyMemberCount: 1,
    },
  ],
  total: 1,
  attentionCount: 0,
  loading: false,
  error: null,
  reload: vi.fn(),
};

vi.mock("@/components/admin/use-admin-applications-list", () => ({
  useAdminApplicationsList: () => listState,
}));

import { AdminApplicationsListClient } from "./admin-applications-list-client";

describe("AdminApplicationsListClient", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows unpaid Fincra checkouts as Checkout Created, drops Fulfilment, and title-cases statuses", () => {
    render(<AdminApplicationsListClient initialAttentionCount={0} />);

    expect(screen.getAllByText("Checkout Created").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ready For Payment").length).toBeGreaterThan(0);
    expect(screen.queryByText("checkout_created")).not.toBeInTheDocument();
    expect(screen.queryByText("ready_for_payment")).not.toBeInTheDocument();

    expect(screen.queryByRole("columnheader", { name: /fulfillment/i })).not.toBeInTheDocument();
    expect(screen.queryByText("not_started")).not.toBeInTheDocument();
  });
});
