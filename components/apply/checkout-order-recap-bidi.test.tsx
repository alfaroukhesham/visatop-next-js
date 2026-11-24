/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogVisaTitle, PartyMemberLine } from "@/components/apply/checkout-order-recap";

const t = (key: string, vars?: Record<string, string | number>) =>
  key === "chooser.durationDays" ? `${vars?.count} days` : key;

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
    expect(name.closest("div")?.textContent).toContain("14 days");
  });

  it("isolates the catalog visa name on a party-member line", () => {
    render(<PartyMemberLine template={"Traveller 2 — \u0000"} serviceName="14 Days - Single Entry" />);
    expect(screen.getByText("14 Days - Single Entry").tagName).toBe("BDI");
    expect(screen.getByText(/Traveller 2/)).toBeInTheDocument();
  });
});
