import { afterEach, describe, expect, it } from "vitest";
import { resolveRuntimeDatabaseUrl } from "@/lib/db/runtime-database-url";

describe("resolveRuntimeDatabaseUrl", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("prefers pooled DATABASE_URL over DATABASE_URL_DIRECT", () => {
    process.env = {
      ...env,
      DATABASE_URL: "postgres://pooler",
      DATABASE_URL_DIRECT: "postgres://direct",
    };
    expect(resolveRuntimeDatabaseUrl()).toBe("postgres://pooler");
  });

  it("falls back to DATABASE_URL_DIRECT when pooled is unset", () => {
    process.env = {
      ...env,
      DATABASE_URL: "",
      DATABASE_URL_DIRECT: "postgres://direct",
    };
    expect(resolveRuntimeDatabaseUrl()).toBe("postgres://direct");
  });
});
