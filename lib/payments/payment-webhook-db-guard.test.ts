import { describe, expect, it } from "vitest";
import { isPostgresOnConflictMissingConstraintError } from "./payment-webhook-db-guard";

describe("isPostgresOnConflictMissingConstraintError", () => {
  it("detects 42P10 on the error object", () => {
    expect(isPostgresOnConflictMissingConstraintError({ code: "42P10" })).toBe(true);
  });

  it("detects 42P10 nested in cause", () => {
    expect(
      isPostgresOnConflictMissingConstraintError({
        code: "23505",
        cause: { code: "42P10" },
      }),
    ).toBe(true);
  });

  it("detects ON CONFLICT wording in message", () => {
    expect(
      isPostgresOnConflictMissingConstraintError({
        message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
      }),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isPostgresOnConflictMissingConstraintError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isPostgresOnConflictMissingConstraintError(null)).toBe(false);
  });
});
