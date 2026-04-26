import { describe, expect, it } from "vitest";
import { assertTrustedJsonPostOrigin } from "./json-post-origin";

describe("assertTrustedJsonPostOrigin", () => {
  it("allows request url origin", () => {
    const req = new Request("http://localhost:3000/api/x", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
    });
    expect(assertTrustedJsonPostOrigin(req, "r1")).toBeNull();
  });

  it("rejects unknown origin", () => {
    const req = new Request("http://localhost:3000/api/x", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
    });
    const res = assertTrustedJsonPostOrigin(req, "r1");
    expect(res).not.toBeNull();
  });
});
