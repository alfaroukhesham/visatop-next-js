import type { NextConfig } from "next";

/**
 * Next.js 16+ blocks cross-origin access to `/_next/*` dev assets (e.g. webpack-hmr /
 * Turbopack) unless the page's host is allowlisted. Opening the app via ngrok triggers
 * that unless the tunnel hostname is listed here.
 *
 * Add your current ngrok host below (update when the subdomain changes), or leave the
 * array empty if `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` already use that URL — those
 * hosts are merged in automatically from env.
 *
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
 */
const EXPLICIT_ALLOWED_DEV_ORIGINS: string[] = [
  "delois-preartistic-quincy.ngrok-free.dev",
];

function collectAllowedDevOriginsFromEnv(): string[] {
  const hosts = new Set<string>();
  const addHostname = (raw?: string) => {
    if (!raw?.trim()) return;
    try {
      hosts.add(new URL(raw.trim()).hostname.toLowerCase());
    } catch {
      /* ignore invalid URLs */
    }
  };

  addHostname(process.env.BETTER_AUTH_URL);
  addHostname(process.env.NEXT_PUBLIC_APP_URL);

  for (const part of process.env.ALLOWED_DEV_ORIGINS?.split(",") ?? []) {
    const t = part.trim();
    if (!t) continue;
    if (t.includes("://")) addHostname(t);
    else hosts.add(t.toLowerCase());
  }

  return [...hosts];
}

function mergeAllowedDevOrigins(): string[] {
  const merged = new Set<string>();
  for (const h of EXPLICIT_ALLOWED_DEV_ORIGINS) {
    const t = h.trim().toLowerCase();
    if (t) merged.add(t);
  }
  for (const h of collectAllowedDevOriginsFromEnv()) {
    merged.add(h);
  }
  return [...merged];
}

const devTunnelHosts =
  process.env.NODE_ENV === "development" ? mergeAllowedDevOrigins() : [];

const nextConfig: NextConfig = {
  basePath: "/visa-processing",
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
  // Node-only native deps used by server routes (OCR / image + PDF normalization).
  // Keeping them external avoids Turbopack trying to bundle their native bindings.
  serverExternalPackages: [
    "sharp",
    "pdfjs-dist",
    "@google/genai",
    "@napi-rs/canvas",
  ],
  ...(devTunnelHosts.length > 0
    ? { allowedDevOrigins: devTunnelHosts }
    : {}),
};

export default nextConfig;
