import { describe, expect, it } from "vitest";
import {
  formatCustomerMessage,
  interpolateCustomerMessage,
  lookupCustomerMessage,
} from "./customer-messages";

const en = {
  resume: {
    title: "Resume from where you started",
    travelers: "{count} travelers",
  },
};

describe("lookupCustomerMessage", () => {
  it("resolves nested keys", () => {
    expect(lookupCustomerMessage(en, "resume.title")).toBe("Resume from where you started");
  });

  it("returns null for missing keys", () => {
    expect(lookupCustomerMessage(en, "resume.missing")).toBeNull();
  });
});

describe("formatCustomerMessage", () => {
  it("interpolates placeholders", () => {
    expect(interpolateCustomerMessage("{count} travelers", { count: 2 })).toBe("2 travelers");
  });

  it("falls back to English then the key", () => {
    expect(formatCustomerMessage({}, en, "resume.title")).toBe("Resume from where you started");
    expect(formatCustomerMessage({}, en, "nope")).toBe("nope");
  });
});
