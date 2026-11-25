/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageWithAmounts } from "./message-with-amounts";

describe("MessageWithAmounts", () => {
  it("keeps the traveller count and noun on one line", () => {
    render(
      <MessageWithAmounts
        template="{price} × {n} مسافرَين = {sum}"
        amounts={{ price: "AED 368.00", n: "2", sum: "AED 736.00" }}
      />,
    );
    const glued = screen.getByText((_, node) => node?.textContent === "2\u00a0مسافرَين");
    expect(glued.className).toContain("whitespace-nowrap");
    expect(glued.textContent).toBe("2\u00a0مسافرَين");
  });
});
