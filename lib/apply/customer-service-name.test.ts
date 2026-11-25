import { describe, expect, it } from "vitest";
import { customerFacingServiceName } from "./customer-service-name";

const t = (key: string, vars?: Record<string, string | number>) => {
  if (key === "chooser.durationDays") return `${vars?.count} يومًا`;
  if (key === "chooser.entryLabels.single") return "دخول مرة واحدة";
  if (key === "chooser.entryLabels.multiple") return "دخول متعدد";
  if (key === "chooser.child") return "طفل";
  return key;
};

describe("customerFacingServiceName", () => {
  it("keeps the catalog name in English", () => {
    expect(
      customerFacingServiceName("14 Days - Single Entry", "en", t, { durationDays: 14, entries: "single" }),
    ).toBe("14 Days - Single Entry");
  });

  it("translates a duration-and-entry catalog name", () => {
    expect(customerFacingServiceName("14 Days - Single Entry", "ar", t)).toBe("14 يومًا · دخول مرة واحدة");
  });

  it("keeps a catalog name that adds words beyond duration and entry", () => {
    expect(customerFacingServiceName("Tourist 14 Days - Single Entry", "ar", t)).toBe(
      "Tourist 14 Days - Single Entry",
    );
  });
});