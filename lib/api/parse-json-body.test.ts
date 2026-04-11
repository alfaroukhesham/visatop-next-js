import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonBody } from "./parse-json-body";

const schema = z.object({ name: z.string().min(1) });

describe("parseJsonBody", () => {
  it("returns Malformed JSON when body is not JSON", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: "{",
      headers: { "Content-Type": "application/json" },
    });
    const out = await parseJsonBody(req, schema, "rid-1");
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.response.status).toBe(400);
    const j = await out.response.json();
    expect(j.ok).toBe(false);
    expect(j.error.code).toBe("VALIDATION_ERROR");
    expect(j.error.message).toMatch(/malformed/i);
  });

  it("returns validation details when JSON parses but schema fails", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: { "Content-Type": "application/json" },
    });
    const out = await parseJsonBody(req, schema, "rid-2");
    expect(out.ok).toBe(false);
    if (out.ok) return;
    const j = await out.response.json();
    expect(j.error.code).toBe("VALIDATION_ERROR");
    expect(j.error.message).toMatch(/validation/i);
    expect(j.error.details).toBeDefined();
  });

  it("returns parsed data on success", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "ok" }),
      headers: { "Content-Type": "application/json" },
    });
    const out = await parseJsonBody(req, schema, null);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.data).toEqual({ name: "ok" });
  });
});
