import { describe, expect, it } from "vitest";
import { DOCUMENT_TYPE } from "@/lib/db/schema/application-document";

describe("DOCUMENT_TYPE", () => {
  it("includes bank_statement_6m for the Africa/Asia tourist rule", () => {
    expect(DOCUMENT_TYPE.BANK_STATEMENT_6M).toBe("bank_statement_6m");
  });
});
