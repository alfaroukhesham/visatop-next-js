/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/admin/admin-application-ops-panel", () => ({
  AdminApplicationOpsPanel: () => null,
}));
vi.mock("@/components/admin/admin-application-travellers", () => ({
  AdminApplicationTravellers: () => null,
}));
vi.mock("@/components/admin/application-actions", () => ({
  ApplicationActions: () => null,
}));
vi.mock("@/components/admin/application-refund-form", () => ({
  ApplicationRefundForm: () => null,
}));

import { AdminApplicationDetailView } from "./admin-application-detail-view";

const createdAt = new Date("2026-11-05T10:00:00.000Z");

describe("AdminApplicationDetailView last step", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the summary-grid last-step field with the same typography as other rows", () => {
    render(
      <AdminApplicationDetailView
        app={{
          id: "app_demo_1",
          referenceNumber: "VT-DEMO-1",
          applicationStatus: "draft",
          paymentStatus: "unpaid",
          fulfillmentStatus: "not_started",
          adminAttentionRequired: false,
          nationalityCode: "IN",
          isGuest: true,
          guestEmail: "demo.guest@example.test",
          adminOpsStep: null,
          createdAt,
          fullName: "Demo Traveller",
          dateOfBirth: null,
          applicantNationality: null,
          passportNumber: null,
          passportExpiryDate: null,
          placeOfBirth: null,
          profession: null,
          address: null,
          phone: null,
        }}
        serviceLabel="30 Days Tourist Visa"
        payments={[]}
        shownAuditLogs={[]}
        adminDocuments={[]}
        travellers={[]}
        selectedTravellerId="app_demo_1"
        lastStep={{
          fieldLabel: "Stopped at",
          value: "Passport upload",
          secondary: "2 hours ago · 11/5/2026, 4:00:00 PM",
        }}
      />,
    );

    expect(screen.getByText("Stopped at")).toBeInTheDocument();
    expect(screen.getByText("Passport upload")).toBeInTheDocument();
    expect(screen.queryByText("2 hours ago · 11/5/2026, 4:00:00 PM")).not.toBeInTheDocument();
    const refresh = screen.getByRole("button", { name: "Refresh" });
    const hint = screen.getByText("Live applicants updates every 15 seconds");
    expect(refresh).toBeInTheDocument();
    expect(hint.closest("dl")).toBeNull();
    expect(refresh).toHaveAttribute("aria-describedby", hint.id);
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getAllByText("Nationality").length).toBeGreaterThan(0);
  });
});
