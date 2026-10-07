import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { applicationDocument } from "./application-document";

describe("application_document sha unique index", () => {
  it("is a partial unique index that excludes deleted rows", () => {
    const { indexes } = getTableConfig(applicationDocument);
    const sha = indexes.find((idx) => idx.config.name === "application_document_app_type_sha_uidx");
    expect(sha).toBeTruthy();
    expect(sha?.config.unique).toBe(true);
    expect(sha?.config.where).toBeTruthy();
  });

  it("ships a backwards-compatible migration that only unique-indexes non-deleted rows", () => {
    const sql = readFileSync(
      "drizzle/0031_application_document_sha_partial_unique.sql",
      "utf8",
    );
    expect(sql).toMatch(/DROP INDEX IF EXISTS "application_document_app_type_sha_uidx"/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "application_document_app_type_sha_uidx"/);
    expect(sql).toMatch(/WHERE\s+"status" IS DISTINCT FROM 'deleted'/);
  });
});
