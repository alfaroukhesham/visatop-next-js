import { afterEach, describe, expect, it } from "vitest";
import {
  getCheckoutRecoveryDelayMs,
  getCheckoutRecoveryMaxAgeMs,
  isRecoveryEmailsEnabled,
} from "./config";

describe("checkout recovery config", () => {
  afterEach(() => {
    delete process.env.RECOVERY_EMAILS_ENABLED;
    delete process.env.RECOVERY_EMAIL_CHECKOUT_DELAY_MINUTES;
    delete process.env.RECOVERY_EMAIL_CHECKOUT_MAX_AGE_HOURS;
  });

  it("defaults to disabled, a 60-minute delay, and a 24-hour max age", () => {
    expect(isRecoveryEmailsEnabled()).toBe(false);
    expect(getCheckoutRecoveryDelayMs()).toBe(60 * 60_000);
    expect(getCheckoutRecoveryMaxAgeMs()).toBe(24 * 60 * 60_000);
  });

  it("enables only when RECOVERY_EMAILS_ENABLED=true", () => {
    process.env.RECOVERY_EMAILS_ENABLED = "true";
    expect(isRecoveryEmailsEnabled()).toBe(true);
    process.env.RECOVERY_EMAILS_ENABLED = "1";
    expect(isRecoveryEmailsEnabled()).toBe(false);
  });

  it("reads a custom delay in minutes and max age in hours", () => {
    process.env.RECOVERY_EMAIL_CHECKOUT_DELAY_MINUTES = "90";
    process.env.RECOVERY_EMAIL_CHECKOUT_MAX_AGE_HOURS = "12";
    expect(getCheckoutRecoveryDelayMs()).toBe(90 * 60_000);
    expect(getCheckoutRecoveryMaxAgeMs()).toBe(12 * 60 * 60_000);
  });
});
