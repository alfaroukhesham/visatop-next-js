import { describe, expect, it } from "vitest";
import { filenameForStoredDocument } from "./document-fetch";

describe("filenameForStoredDocument", () => {
  it("rewrites a passport PDF name to the stored JPEG extension", () => {
    expect(filenameForStoredDocument("passport.pdf", "image/jpeg", "document")).toBe("passport.jpg");
    expect(filenameForStoredDocument("passport.PDF", "image/jpeg; charset=binary", "document")).toBe(
      "passport.jpg",
    );
    expect(filenameForStoredDocument("scan.png", "image/jpeg", "document")).toBe("scan.jpg");
    expect(filenameForStoredDocument("scan.jpeg", "image/jpeg", "document")).toBe("scan.jpg");
    expect(filenameForStoredDocument("scan.heic", "image/jpeg", "document")).toBe("scan.jpg");
  });

  it("keeps a real PDF name", () => {
    expect(filenameForStoredDocument("statement.pdf", "application/pdf", "document")).toBe(
      "statement.pdf",
    );
  });

  it("falls back when the original name is blank", () => {
    expect(filenameForStoredDocument("  ", "image/jpeg", "document")).toBe("document.jpg");
    expect(filenameForStoredDocument(null, "image/jpeg", "document")).toBe("document.jpg");
  });

  it("strips quotes, newlines, and slashes before the download name", () => {
    expect(filenameForStoredDocument('say"hi.pdf', "image/jpeg", "document")).toBe("say_hi.jpg");
    expect(filenameForStoredDocument("pass\r\nport.pdf", "image/jpeg", "document")).toBe(
      "pass__port.jpg",
    );
    expect(filenameForStoredDocument("a/b.pdf", "image/jpeg", "document")).toBe("a_b.jpg");
  });

  it("keeps an unknown type on the sanitized original name", () => {
    expect(filenameForStoredDocument("a/b.pdf", "application/octet-stream", "document")).toBe(
      "a_b.pdf",
    );
  });
});
