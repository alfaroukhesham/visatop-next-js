/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const i18n = vi.hoisted(() => ({ locale: "en" }));

vi.mock("@/components/client/customer-i18n-provider", () => ({
  useCustomerT: () => (key: string) => key,
  useCustomerLocale: () => i18n.locale,
}));

import { TravelDateStep } from "@/components/apply/travel-date-step";

const renderStep = (value = "", onChange = vi.fn()) => {
  const onContinue = vi.fn();
  const onSkip = vi.fn();
  render(
    <TravelDateStep
      value={value}
      onChange={onChange}
      todayUae="2026-11-24"
      maxTravelDate="2027-05-23"
      onContinue={onContinue}
      onSkip={onSkip}
    />,
  );
  return { onChange, onContinue, onSkip };
};

describe("TravelDateStep", () => {
  afterEach(() => {
    cleanup();
    i18n.locale = "en";
  });

  it("shows an inline month grid without a date field or shortcut buttons", () => {
    renderStep();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "start.travelDate.today" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "start.travelDate.tomorrow" })).not.toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
    expect(screen.getByRole("button", { name: "start.travelDate.previousMonth" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "start.travelDate.notSure" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "start.travelDate.seeVisas" })).toBeInTheDocument();
    expect(screen.getByTestId("departure-date-readback")).toHaveTextContent("—");
  });

  it("selects a future day, keeps today available, and ignores past days", async () => {
    const user = userEvent.setup();
    const { onChange, onContinue, onSkip } = renderStep();
    const past = screen.getByRole("gridcell", { name: /November 23, 2026/ });
    const today = screen.getByRole("gridcell", { name: /November 24, 2026/ });
    const later = screen.getByRole("gridcell", { name: /November 26, 2026/ });
    expect(past).toHaveAttribute("aria-disabled", "true");
    expect(today).toHaveAttribute("aria-disabled", "false");
    expect(today).toHaveAttribute("aria-current", "date");
    await user.click(past);
    expect(onChange).not.toHaveBeenCalled();
    await user.click(later);
    expect(onChange).toHaveBeenCalledWith("2026-11-26");
    expect(onContinue).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("reads back a saved date and continues with it", async () => {
    const user = userEvent.setup();
    const { onContinue, onSkip } = renderStep("2026-12-24");
    expect(screen.getByRole("grid", { name: "December 2026" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /December 24, 2026/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("departure-date-readback")).toHaveTextContent("December 24, 2026");
    expect(screen.getByRole("button", { name: "start.travelDate.previousMonth" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "start.travelDate.seeVisas" }));
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("skips when no date is chosen and mirrors chevrons for Arabic", async () => {
    const user = userEvent.setup();
    const { onSkip, onContinue } = renderStep();
    await user.click(screen.getByRole("button", { name: "start.travelDate.seeVisas" }));
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled();
    cleanup();

    i18n.locale = "ar";
    renderStep();
    const prev = screen.getByRole("button", { name: "start.travelDate.previousMonth" });
    expect(prev.querySelector("svg")).toHaveClass("rtl:rotate-180");
    expect(screen.getByRole("columnheader", { name: /سبت/ })).toBeInTheDocument();
  });

  it("moves focus with the arrow keys", async () => {
    const user = userEvent.setup();
    renderStep("2026-11-26");
    const selected = screen.getByRole("gridcell", { name: /November 26, 2026/ });
    selected.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("gridcell", { name: /November 27, 2026/ })).toHaveFocus();
  });
});
