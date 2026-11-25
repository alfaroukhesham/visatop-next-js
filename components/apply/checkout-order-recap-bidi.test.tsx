/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogVisaTitle, PartyMemberLine } from "@/components/apply/checkout-order-recap";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

const t = (key: string, vars?: Record<string, string | number>) => {
  if (key === "chooser.durationDays") return `${vars?.count} days`;
  if (key === "chooser.entryLabels.single") return "Single entry";
  if (key === "chooser.entryLabels.multiple") return "Multiple entry";
  return key;
};

describe("payment recap catalog names", () => {
  afterEach(() => {
    cleanup();
  });

  it("isolates the catalog visa name on the order title", () => {
    render(
      <CatalogVisaTitle
        service={{
          id: "svc",
          name: "14 Days - Single Entry",
          durationDays: 14,
          entries: "single",
          displayPriceMinor: null,
          currency: null,
        }}
        t={t}
      />,
    );
    const name = screen.getByText("14 Days - Single Entry");
    expect(name.tagName).toBe("BDI");
    expect(name).toHaveAttribute("title", "14 Days - Single Entry");
    expect(name.closest("div")?.textContent).toBe("14 Days - Single Entry");
  });

  it("does not repeat multiple entry when the catalog name says Multi Entry", () => {
    render(
      <CatalogVisaTitle
        service={{
          id: "svc",
          name: "14 Days - Multi Entry",
          durationDays: 14,
          entries: "multiple",
          displayPriceMinor: null,
          currency: null,
        }}
        t={t}
      />,
    );
    const name = screen.getByText("14 Days - Multi Entry");
    expect(name).toHaveAttribute("title", "14 Days - Multi Entry");
    expect(name.closest("div")?.textContent).toBe("14 Days - Multi Entry");
  });

  it("keeps duration and entry when the catalog name does not already say them", () => {
    render(
      <CatalogVisaTitle
        service={{
          id: "svc",
          name: "Tourist",
          durationDays: 14,
          entries: "single",
          displayPriceMinor: null,
          currency: null,
        }}
        t={t}
      />,
    );
    expect(screen.getByText("Tourist").closest("div")?.textContent).toBe(
      "14 days · Single entry · Tourist",
    );
  });

  it("skips the entry fact from the catalog name for the Arabic translator", () => {
    const ar = createCustomerT("ar");
    const service = {
      id: "svc",
      durationDays: null,
      displayPriceMinor: null,
      currency: null,
    };
    render(
      <CatalogVisaTitle
        locale="ar"
        service={{ ...service, name: "Tourist - Multi Entry", entries: "multiple" }}
        t={ar}
      />,
    );
    expect(screen.getByText("Tourist - Multi Entry").closest("div")?.textContent).toBe(
      "Tourist - Multi Entry",
    );
    cleanup();
    render(
      <CatalogVisaTitle
        locale="ar"
        service={{ ...service, name: "Tourist - Single Entry", entries: "single" }}
        t={ar}
      />,
    );
    expect(screen.getByText("Tourist - Single Entry").closest("div")?.textContent).toBe(
      "Tourist - Single Entry",
    );
  });

  it("keeps multiple entry when the catalog name does not say multi", () => {
    render(
      <CatalogVisaTitle
        service={{
          id: "svc",
          name: "Tourist",
          durationDays: 30,
          entries: "multiple",
          displayPriceMinor: null,
          currency: null,
        }}
        t={t}
      />,
    );
    expect(screen.getByText("Tourist").closest("div")?.textContent).toBe(
      "30 days · Multiple entry · Tourist",
    );
  });

  it("isolates the catalog visa name on a party-member line", () => {
    render(<PartyMemberLine template={"Traveller 2 — \u0000"} serviceName="14 Days - Single Entry" />);
    expect(screen.getByText("14 Days - Single Entry").tagName).toBe("BDI");
    expect(screen.getByText(/Traveller 2/)).toBeInTheDocument();
  });
});
