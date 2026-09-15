import { describe, expect, it } from "vitest";
import { isForeignKeyViolation, isUniqueViolation } from "./pg-errors";

describe("isForeignKeyViolation", () => {
  it("returns true for Postgres error code 23503", () => {
    expect(isForeignKeyViolation({ code: "23503" })).toBe(true);
  });

  it("walks error.cause for wrapped drivers", () => {
    expect(
      isForeignKeyViolation({
        message: "wrapper",
        cause: { code: "23503" },
      }),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isForeignKeyViolation(new Error("boom"))).toBe(false);
    expect(isForeignKeyViolation({ code: "23505" })).toBe(false);
  });
});

describe("isUniqueViolation", () => {
  it("returns true for Postgres error code 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
  });
});
