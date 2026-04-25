import { getAppOrigin } from "@/lib/app-url";

export type ActivePaymentProvider = "paddle" | "ziina";

/** Ziina webhook source IPs (docs.ziina.com/api-reference/webhook/index). */
export const ZIINA_WEBHOOK_SOURCE_IPS = new Set<string>([
  "3.29.184.186",
  "3.29.190.95",
  "20.233.47.127",
  "13.202.161.181",
]);

export function getActivePaymentProvider(): ActivePaymentProvider {
  const raw = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();
  if (raw === "ziina") return "ziina";
  return "paddle";
}

export function assertPaddleServerConfigured(): void {
  if (!process.env.PADDLE_API_KEY?.trim()) {
    throw new Error("PADDLE_API_KEY is required for Paddle checkout");
  }
}

export type ZiinaServerConfig = {
  apiBaseUrl: string;
  accessToken: string;
  testMode: boolean;
};

export function getZiinaServerConfig(): ZiinaServerConfig {
  const token = process.env.ZIINA_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("ZIINA_ACCESS_TOKEN is required when PAYMENT_PROVIDER=ziina");
  }
  const base =
    process.env.ZIINA_API_BASE_URL?.trim().replace(/\/$/, "") || "https://api-v2.ziina.com/api";
  const testRaw = process.env.ZIINA_TEST_MODE?.trim().toLowerCase();
  const testMode = testRaw === "true" || testRaw === "1";
  return { apiBaseUrl: base, accessToken: token, testMode };
}

/**
 * Absolute origin for Ziina return URLs. Fails if no server-resolvable origin (spec risk register).
 */
export function requireCheckoutAppOrigin(): string {
  const origin = getAppOrigin().trim();
  if (!origin) {
    throw new Error("Cannot resolve app origin: set NEXT_PUBLIC_APP_URL or BETTER_AUTH_URL");
  }
  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://")) {
    throw new Error("Production checkout requires HTTPS app origin (NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL)");
  }
  return origin.replace(/\/$/, "");
}

export function isHttpsOrigin(origin: string): boolean {
  return origin.trim().toLowerCase().startsWith("https://");
}

export function shouldAllowInsecureLocalhostPayments(): boolean {
  const raw = process.env.PAYMENTS_ALLOW_INSECURE_LOCALHOST?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

let warnedInsecureLocalhost = false;

/**
 * In local development, webhooks cannot reliably reach `http://localhost`, so we block checkout unless
 * the app origin is https (tunnel) or an explicit bypass env is set.
 */
export function assertPaymentsAllowedForOrigin(origin: string): { ok: true } | { ok: false; message: string } {
  if (process.env.NODE_ENV === "test") return { ok: true };
  if (isHttpsOrigin(origin)) return { ok: true };
  if (shouldAllowInsecureLocalhostPayments()) {
    if (!warnedInsecureLocalhost) {
      warnedInsecureLocalhost = true;
      console.warn("[payments] PAYMENTS_ALLOW_INSECURE_LOCALHOST=true — allowing checkout without https origin", {
        origin,
      });
    }
    return { ok: true };
  }
  return {
    ok: false,
    message:
      "Payments require an https app URL (ngrok/cloudflared) so webhooks can reach your machine. " +
      "Set NEXT_PUBLIC_APP_URL/BETTER_AUTH_URL to your tunnel https URL, then retry.",
  };
}
