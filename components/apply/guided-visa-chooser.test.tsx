/** @vitest-environment jsdom */

import { useState, type FC } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GuidedVisaChooser, type IService } from "@/components/apply/guided-visa-chooser";
import { CustomerI18nProvider } from "@/components/client/customer-i18n-provider";
import en from "@/messages/customer/en.json";

const oneVisa: IService[] = [
  {
    id: "only",
    name: "30 Days Single Entry Adult",
    durationDays: 30,
    entries: "single",
    displayPriceMinor: "10000",
    currency: "USD",
    stayBucket: "15_30",
    entryKind: "single",
    travelerKind: "adult",
    showInGuidedChooser: true,
  },
];

const Harness: FC = () => {
  const [serviceId, setServiceId] = useState("");
  return (
    <CustomerI18nProvider locale="en" messages={en} fallback={en}>
      <GuidedVisaChooser
        services={oneVisa}
        formatPrice={() => ({ text: "$100", isEstimate: false })}
        selectedServiceId={serviceId}
        onSelectService={setServiceId}
      />
    </CustomerI18nProvider>
  );
};

test("a single SKU still shows duration, then frequency, then adult", async () => {
  const user = userEvent.setup();
  render(<Harness />);

  expect(screen.getByRole("heading", { name: "How long is your stay?" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /15–30 days/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /1–14 days/ })).not.toBeInTheDocument();
  expect(screen.queryByText("30 Days Single Entry Adult")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /15–30 days/ }));

  expect(screen.getByRole("heading", { name: "Single or multiple entry?" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Single entry/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Multiple entry/ })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /Single entry/ }));

  expect(screen.getByRole("heading", { name: "Who is this visa for?" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Adult/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Child/ })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /^Adult/ }));

  expect(screen.getByRole("button", { name: /30 Days Single Entry Adult/ })).toBeInTheDocument();
  expect(screen.queryByText(/No visa matches/)).not.toBeInTheDocument();
});
