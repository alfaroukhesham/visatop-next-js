import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "./sentry-scrub";

const piiPayload = () => ({
  message: "checkout failed",
  request: {
    url: "https://visatop.com/visa-processing/api/checkout",
    method: "POST",
    data: {
      guestEmail: "traveler@example.com",
      fullName: "Ada Lovelace",
      passportNumber: "A12345678",
      phone: "+971500000000",
      dateOfBirth: "1990-01-02",
    },
    cookies: { vt_session: "secret-cookie" },
    headers: {
      cookie: "vt_session=secret-cookie",
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    query_string: "email=traveler@example.com",
  },
  user: {
    id: "user_1",
    email: "traveler@example.com",
    username: "Ada Lovelace",
    ip_address: "203.0.113.10",
  },
  extra: {
    applicant: {
      email: "traveler@example.com",
      name: "Ada Lovelace",
      passport: "A12345678",
      phoneNumber: "+971500000000",
      dob: "1990-01-02",
    },
    applicationId: "app_safe_id",
  },
  contexts: {
    profile: {
      firstName: "Ada",
      lastName: "Lovelace",
      passport_number: "A12345678",
      date_of_birth: "1990-01-02",
    },
  },
  tags: {
    applicationId: "app_safe_id",
    payment_provider: "paddle",
  },
});

describe("scrubSentryEvent", () => {
  it("strips request bodies, cookies, and headers", () => {
    const event = scrubSentryEvent(piiPayload());
    expect(event?.request?.data).toBeUndefined();
    expect(event?.request?.cookies).toBeUndefined();
    expect(event?.request?.headers).toBeUndefined();
    expect(event?.request?.query_string).toBeUndefined();
    expect(event?.request?.url).toBe("https://visatop.com/visa-processing/api/checkout");
  });

  it("redacts email, name, passport, phone, and DOB fields anywhere in the event", () => {
    const event = scrubSentryEvent(piiPayload());
    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(/traveler@example\.com/i);
    expect(serialized).not.toMatch(/Ada Lovelace/);
    expect(serialized).not.toMatch(/A12345678/);
    expect(serialized).not.toMatch(/\+971500000000/);
    expect(serialized).not.toMatch(/1990-01-02/);
    expect(serialized).not.toMatch(/secret-cookie/);
    expect(serialized).not.toMatch(/Bearer secret/);
    expect(event?.extra?.applicant).toMatchObject({
      email: "[Filtered]",
      name: "[Filtered]",
      passport: "[Filtered]",
      phoneNumber: "[Filtered]",
      dob: "[Filtered]",
    });
    expect(event?.contexts?.profile).toMatchObject({
      firstName: "[Filtered]",
      lastName: "[Filtered]",
      passport_number: "[Filtered]",
      date_of_birth: "[Filtered]",
    });
    expect(event?.user?.email).toBe("[Filtered]");
    expect(event?.user?.username).toBe("[Filtered]");
    expect(event?.user?.ip_address).toBe("[Filtered]");
  });

  it("redacts Meta CAPI token and click-id fields", () => {
    const event = scrubSentryEvent({
      extra: {
        access_token: "EAAB-capi-secret",
        capiToken: "EAAB-capi-secret",
        fbp: "fb.1.1.abc",
        fbc: "fb.1.1.def",
        fbclid: "IwAR0click",
        applicationId: "app_safe_id",
      },
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(/EAAB-capi-secret/);
    expect(serialized).not.toMatch(/fb\.1\.1\.abc/);
    expect(serialized).not.toMatch(/IwAR0click/);
    expect(event.extra).toMatchObject({
      access_token: "[Filtered]",
      capiToken: "[Filtered]",
      fbp: "[Filtered]",
      fbc: "[Filtered]",
      fbclid: "[Filtered]",
      applicationId: "app_safe_id",
    });
  });

  it("keeps operational tags such as applicationId and payment provider", () => {
    const event = scrubSentryEvent(piiPayload());
    expect(event?.tags).toEqual({
      applicationId: "app_safe_id",
      payment_provider: "paddle",
    });
    expect(event?.extra?.applicationId).toBe("app_safe_id");
  });

  it("redacts matching keys on transaction-style events", () => {
    const event = scrubSentryEvent({
      type: "transaction",
      transaction: "/visa-processing/apply/applications/app_1/payment",
      request: {
        data: { passportNumber: "X999" },
        cookies: { a: "b" },
        headers: { cookie: "a=b" },
      },
      contexts: {
        trace: { op: "http.server", data: { email: "hidden@example.com" } },
      },
    });
    expect(event?.request?.data).toBeUndefined();
    expect(event?.request?.cookies).toBeUndefined();
    expect(event?.request?.headers).toBeUndefined();
    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(/hidden@example\.com/);
    expect(serialized).not.toMatch(/X999/);
    expect(event?.transaction).toBe("/visa-processing/apply/applications/app_1/payment");
  });
});
