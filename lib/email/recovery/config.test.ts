import { afterEach, describe, expect, it } from "vitest";
import { getCheckoutRecoveryDelayMs, isRecoveryEmailsEnabled } from "./config";

describe("checkout recovery config", () => {
  afterEach(() => {
    delete process.env.RECOVERY_EMAILS_ENABLED;
    delete process.env.RECOVERY_EMAIL_CHECKOUT_DELAY_MINUTES;
  });

  it("defaults to disabled and a 60-minute delay", () => {
    expect(isRecoveryEmailsEnabled()).toBe(false);
    expect(getCheckoutRecoveryDelayMs()).toBe(60 * 60_000);
  });

  it("enables only when RECOVERY_EMAILS_ENABLED=true", () => {
    process.env.RECOVERY_EMAILS_ENABLED = "true";
    expect(isRecoveryEmailsEnabled()).toBe(true);
    process.env.RECOVERY_EMAILS_ENABLED = "1";
    expect(isRecoveryEmailsEnabled()).toBe(false);
  });

  it("reads a custom delay in minutes", () => {
    process.env.RECOVERY_EMAIL_CHECKOUT_DELAY_MINUTES = "90";
    expect(getCheckoutRecoveryDelayMs()).toBe(90 * 60_000);
  });
});
