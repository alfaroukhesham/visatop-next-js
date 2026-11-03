import { apiHref } from "@/lib/app-href";
import { getAppOrigin } from "@/lib/app-url";

export const PLATFORM_KEY_ZIINA_WEBHOOK_LAST_REGISTRATION = "ziina_webhook_last_registration";

export type TZiinaWebhookRegistrationRecord = {
  url: string;
  host: string;
  origin: string;
  registeredAt: string;
  nodeEnv: string;
  nonProdRegistrar: boolean;
};

const normalizeUrl = (raw: string): URL | null => {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    url.search = "";
    if (url.pathname.endsWith("/") && url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    }
    return url;
  } catch {
    return null;
  }
};

export const expectedZiinaWebhookUrl = (): string => {
  const fromEnv = process.env.ZIINA_EXPECTED_WEBHOOK_URL?.trim();
  if (fromEnv) return fromEnv;
  return apiHref("webhooks/ziina");
};

export const hostFromWebhookUrl = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  return normalizeUrl(raw)?.host ?? null;
};

export const ziinaWebhookUrlMatchesExpected = (
  registeredUrl: string | null | undefined,
  expectedUrl: string = expectedZiinaWebhookUrl(),
): boolean => {
  if (!registeredUrl) return false;
  const registered = normalizeUrl(registeredUrl);
  const expected = normalizeUrl(expectedUrl);
  if (!registered || !expected) return false;
  return (
    registered.host.toLowerCase() === expected.host.toLowerCase() &&
    registered.pathname === expected.pathname
  );
};

export const isNonProdZiinaWebhookRegistrar = (): boolean => {
  const expected = process.env.ZIINA_EXPECTED_WEBHOOK_URL?.trim();
  if (expected) {
    return !ziinaWebhookUrlMatchesExpected(apiHref("webhooks/ziina"), expected);
  }
  let host = "";
  try {
    host = new URL(getAppOrigin()).hostname.toLowerCase();
  } catch {
    return true;
  }
  return host !== "visatop.com" && host !== "www.visatop.com";
};

export const parseZiinaWebhookRegistrationRecord = (
  raw: string | null | undefined,
): TZiinaWebhookRegistrationRecord | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TZiinaWebhookRegistrationRecord;
    if (!parsed || typeof parsed !== "object" || typeof parsed.url !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
};

export const buildZiinaWebhookRegistrationRecord = (
  url: string,
  now: Date = new Date(),
): TZiinaWebhookRegistrationRecord => {
  let origin = "";
  let host = "";
  try {
    const parsed = new URL(url);
    origin = parsed.origin;
    host = parsed.host;
  } catch {
    host = url;
  }
  return {
    url,
    host,
    origin,
    registeredAt: now.toISOString(),
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    nonProdRegistrar: isNonProdZiinaWebhookRegistrar(),
  };
};
