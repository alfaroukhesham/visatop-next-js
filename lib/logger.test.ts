import { Writable } from "node:stream";
import { isSpanContextValid, trace, TraceFlags } from "@opentelemetry/api";
import type { Logger } from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppLogger, createRequestLogger } from "./logger";

const CENSOR = "[redacted]";

const flush = async (log: Logger) => {
  await new Promise<void>((resolve) => {
    log.flush(() => resolve());
  });
};

const captureLogger = (env?: Record<string, string | undefined>) => {
  const previous: Record<string, string | undefined> = {};
  const merged: Record<string, string | undefined> = { LOG_LEVEL: "debug", ...env };
  for (const [key, value] of Object.entries(merged)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      const text = String(chunk);
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        lines.push(JSON.parse(line) as Record<string, unknown>);
      }
      callback();
    },
  });
  const log = createAppLogger(stream);
  return {
    log,
    lines,
    restore: () => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    },
  };
};

const serialized = (line: Record<string, unknown>) => JSON.stringify(line);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createAppLogger base fields", () => {
  it("sets service, APP_ENV (not NODE_ENV), and release sha on every line", async () => {
    const { log, lines, restore } = captureLogger({
      APP_ENV: "staging",
      NODE_ENV: "production",
      GIT_SHA: "deadbeefcafebabe",
      OTEL_SERVICE_NAME: "visatop-next-js",
    });
    try {
      log.info("hello");
      await flush(log);
      expect(lines).toHaveLength(1);
      expect(lines[0]?.service).toBe("visatop-next-js");
      expect(lines[0]?.env).toBe("staging");
      expect(lines[0]?.env).not.toBe("production");
      expect(lines[0]?.release).toBe("deadbeefcafebabe");
      expect(lines[0]?.msg).toBe("hello");
    } finally {
      restore();
    }
  });

  it("does not fall back to NODE_ENV when APP_ENV is unset", async () => {
    const { log, lines, restore } = captureLogger({
      APP_ENV: undefined,
      NODE_ENV: "production",
      GIT_SHA: undefined,
      GIT_COMMIT_SHA: undefined,
      SOURCE_VERSION: undefined,
      OTEL_SERVICE_NAME: undefined,
    });
    try {
      log.info("no app env");
      await flush(log);
      expect(lines[0]?.env).toBe("unknown");
      expect(lines[0]?.env).not.toBe("production");
      expect(lines[0]?.release).toBe("unknown");
      expect(lines[0]?.service).toBe("visatop-next-js");
    } finally {
      restore();
    }
  });
});

describe("redaction", () => {
  it("redacts PII, tokens, cookies, and authorization at the top level and one nested level", async () => {
    const { log, lines, restore } = captureLogger();
    try {
      log.info(
        {
          email: "traveler@example.com",
          guestEmail: "guest@example.com",
          fullName: "Ada Lovelace",
          name: "Ada",
          firstName: "Ada",
          lastName: "Lovelace",
          passportNumber: "A12345678",
          phone: "+971500000000",
          address: "1 Sheikh Zayed Rd",
          dateOfBirth: "1815-12-10",
          token: "tok_live_secret",
          tokens: { access: "abc" },
          cookie: "session=abc",
          cookies: "session=abc",
          authorization: "Bearer secret",
          applicant: {
            email: "nested@example.com",
            guestEmail: "nested-guest@example.com",
            fullName: "Nested Name",
            name: "Nested",
            firstName: "Nested",
            lastName: "Name",
            passportNumber: "B99999999",
            phone: "+15551212",
            address: "Nested Ave",
            dateOfBirth: "1990-01-01",
            token: "nested-token",
            tokens: ["a"],
            cookie: "sid=1",
            cookies: "sid=1",
            authorization: "Bearer nested",
          },
        },
        "pii",
      );
      await flush(log);
      const line = lines[0] ?? {};
      const raw = serialized(line);
      expect(raw).not.toContain("traveler@example.com");
      expect(raw).not.toContain("guest@example.com");
      expect(raw).not.toContain("nested@example.com");
      expect(raw).not.toContain("Ada Lovelace");
      expect(raw).not.toContain("A12345678");
      expect(raw).not.toContain("B99999999");
      expect(raw).not.toContain("+971500000000");
      expect(raw).not.toContain("tok_live_secret");
      expect(raw).not.toContain("Bearer secret");
      expect(raw).not.toContain("1815-12-10");

      const topKeys = [
        "email",
        "guestEmail",
        "fullName",
        "name",
        "firstName",
        "lastName",
        "passportNumber",
        "phone",
        "address",
        "dateOfBirth",
        "token",
        "tokens",
        "cookie",
        "cookies",
        "authorization",
      ] as const;
      for (const key of topKeys) {
        expect(line[key], key).toBe(CENSOR);
      }

      const nested = line.applicant as Record<string, unknown>;
      for (const key of topKeys) {
        expect(nested[key], `applicant.${key}`).toBe(CENSOR);
      }
    } finally {
      restore();
    }
  });

  it("still redacts existing passport, document, ocr, extraction, and pii glob paths", async () => {
    const { log, lines, restore } = captureLogger();
    try {
      log.info(
        {
          upload: {
            passportImage: "<bytes>",
            documentBlob: "<bytes>",
            ocrJson: { givenNames: "secret" },
            extractionResult: { mrz: "secret" },
            piiDump: { ssn: "secret" },
          },
        },
        "globs",
      );
      await flush(log);
      const raw = serialized(lines[0] ?? {});
      expect(raw).not.toContain("<bytes>");
      expect(raw).not.toContain("givenNames");
      expect(raw).not.toContain("ssn");
      const upload = lines[0]?.upload as Record<string, unknown>;
      expect(upload.passportImage).toBe(CENSOR);
      expect(upload.documentBlob).toBe(CENSOR);
      expect(upload.ocrJson).toBe(CENSOR);
      expect(upload.extractionResult).toBe(CENSOR);
      expect(upload.piiDump).toBe(CENSOR);
    } finally {
      restore();
    }
  });

  it("redacts Meta CAPI token and click-id fields", async () => {
    const { log, lines, restore } = captureLogger();
    try {
      log.info(
        {
          access_token: "EAAB-capi-secret",
          capiToken: "EAAB-capi-secret",
          metaCapiToken: "EAAB-capi-secret",
          fbp: "fb.1.1.abc",
          fbc: "fb.1.1.def",
          fbclid: "IwAR0click",
          applicationId: "app_1",
        },
        "capi",
      );
      await flush(log);
      const raw = serialized(lines[0] ?? {});
      expect(raw).not.toContain("EAAB-capi-secret");
      expect(raw).not.toContain("fb.1.1.abc");
      expect(raw).not.toContain("IwAR0click");
      expect(lines[0]?.access_token).toBe(CENSOR);
      expect(lines[0]?.capiToken).toBe(CENSOR);
      expect(lines[0]?.metaCapiToken).toBe(CENSOR);
      expect(lines[0]?.fbp).toBe(CENSOR);
      expect(lines[0]?.applicationId).toBe("app_1");
    } finally {
      restore();
    }
  });

  it("does not redact documentId or documentType correlation fields", async () => {
    const { log, lines, restore } = captureLogger();
    try {
      log.info(
        { documentId: "doc_abc", documentType: "passport_copy", applicationId: "app_1" },
        "ids",
      );
      await flush(log);
      expect(lines[0]?.documentId).toBe("doc_abc");
      expect(lines[0]?.documentType).toBe("passport_copy");
      expect(lines[0]?.applicationId).toBe("app_1");
    } finally {
      restore();
    }
  });

  it("redacts raw webhook payload fields so bodies are never logged", async () => {
    const { log, lines, restore } = captureLogger();
    try {
      log.info(
        {
          event: "charge.success",
          rawBody: '{"email":"leak@example.com","card":"4111"}',
          bodyText: '{"passportNumber":"X111"}',
          rawPayload: { email: "leak@example.com" },
          webhookPayload: { fullName: "Leaked" },
          webhook: {
            rawBody: "secret-body",
            bodyText: "secret-text",
            rawPayload: { n: 1 },
            webhookPayload: { n: 2 },
          },
        },
        "webhook",
      );
      await flush(log);
      const line = lines[0] ?? {};
      const raw = serialized(line);
      expect(raw).not.toContain("leak@example.com");
      expect(raw).not.toContain("4111");
      expect(raw).not.toContain("X111");
      expect(raw).not.toContain("secret-body");
      expect(line.rawBody).toBe(CENSOR);
      expect(line.bodyText).toBe(CENSOR);
      expect(line.rawPayload).toBe(CENSOR);
      expect(line.webhookPayload).toBe(CENSOR);
      const nested = line.webhook as Record<string, unknown>;
      expect(nested.rawBody).toBe(CENSOR);
      expect(nested.bodyText).toBe(CENSOR);
      expect(nested.rawPayload).toBe(CENSOR);
      expect(nested.webhookPayload).toBe(CENSOR);
      expect(line.event).toBe("charge.success");
    } finally {
      restore();
    }
  });
});

describe("createRequestLogger", () => {
  it("child logger carries requestId from x-request-id", async () => {
    const { log, lines, restore } = captureLogger();
    try {
      const child = createRequestLogger("req-from-proxy", log);
      child.info("with request");
      await flush(child);
      expect(lines[0]?.requestId).toBe("req-from-proxy");
      expect(lines[0]?.msg).toBe("with request");
    } finally {
      restore();
    }
  });

  it("child logger carries OpenTelemetry traceId and spanId when a valid span is active", async () => {
    const { log, lines, restore } = captureLogger();
    try {
      const traceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const spanId = "bbbbbbbbbbbbbbbb";
      vi.spyOn(trace, "getActiveSpan").mockReturnValue({
        spanContext: () => ({
          traceId,
          spanId,
          traceFlags: TraceFlags.SAMPLED,
          isRemote: false,
        }),
      } as never);
      expect(
        isSpanContextValid({
          traceId,
          spanId,
          traceFlags: TraceFlags.SAMPLED,
        }),
      ).toBe(true);

      const child = createRequestLogger("req-traced", log);
      child.info("traced");
      await flush(child);
      expect(lines[0]?.requestId).toBe("req-traced");
      expect(lines[0]?.traceId).toBe(traceId);
      expect(lines[0]?.spanId).toBe(spanId);
    } finally {
      restore();
    }
  });

  it("omits traceId and spanId when no valid span is present", async () => {
    const { log, lines, restore } = captureLogger();
    try {
      vi.spyOn(trace, "getActiveSpan").mockReturnValue(undefined);
      const child = createRequestLogger("req-no-span", log);
      child.info("no span");
      await flush(child);
      expect(lines[0]?.requestId).toBe("req-no-span");
      expect(lines[0]?.traceId).toBeUndefined();
      expect(lines[0]?.spanId).toBeUndefined();
    } finally {
      restore();
    }
  });
});
