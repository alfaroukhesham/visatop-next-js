/** @vitest-environment jsdom */

import { useState, type FC } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NationalityCombobox } from "@/components/client/nationality-combobox";

const OPTIONS = [
  { code: "FR", name: "France" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
];

const Harness: FC = () => {
  const [code, setCode] = useState<string | null>(null);
  return (
    <NationalityCombobox
      id="nationality-input"
      nationalities={OPTIONS}
      valueCode={code}
      onSelectCode={setCode}
      placeholder="Type your country…"
    />
  );
};

test("reopening after a selection shows the full nationality dropdown", async () => {
  const user = userEvent.setup();
  render(<Harness />);

  const input = screen.getByRole("combobox");
  await user.click(input);
  await user.click(screen.getByRole("option", { name: "India" }));

  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

  await user.click(input);

  expect(screen.getByRole("option", { name: "France" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "India" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Pakistan" })).toBeInTheDocument();
});
