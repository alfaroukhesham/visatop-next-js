import { describe, expect, it } from "vitest";
import { requiresAfricaAsiaBankStatementNationality } from "./nationality-regions";

describe("requiresAfricaAsiaBankStatementNationality", () => {
  it("includes India, Nigeria, Turkey, Egypt, South Africa", () => {
    for (const code of ["IN", "NG", "TR", "EG", "ZA"]) {
      expect(requiresAfricaAsiaBankStatementNationality(code)).toBe(true);
    }
  });

  it("excludes France, United States, Russia, Cyprus", () => {
    for (const code of ["FR", "US", "RU", "CY"]) {
      expect(requiresAfricaAsiaBankStatementNationality(code)).toBe(false);
    }
  });
});
