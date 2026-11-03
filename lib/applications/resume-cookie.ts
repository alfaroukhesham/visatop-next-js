/** Guest resume session cookie (plaintext token is HttpOnly — not in JSON). */
export const RESUME_COOKIE_NAME = "vt_resume";
/** Must match Next `basePath` so rotation overwrites the original guest cookie. */
export const RESUME_COOKIE_PATH = "/visa-processing";

const cookieFlags = (opts?: { secure?: boolean }): string[] => {
  const secure = opts?.secure ?? process.env.NODE_ENV === "production";
  const parts = ["HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts;
};

export const buildResumeSetCookieValue = (
  plainToken: string,
  maxAgeSeconds: number,
  opts?: { secure?: boolean },
): string => {
  const parts = [
    `${RESUME_COOKIE_NAME}=${encodeURIComponent(plainToken)}`,
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    `Path=${RESUME_COOKIE_PATH}`,
    ...cookieFlags(opts),
  ];
  return parts.join("; ");
};

/** Expire a leftover Path=/ cookie so rotation does not leave two vt_resume values. */
export const buildResumeClearRootCookieValue = (opts?: { secure?: boolean }): string =>
  [`${RESUME_COOKIE_NAME}=`, "Max-Age=0", "Path=/", ...cookieFlags(opts)].join("; ");

export const appendResumeSetCookieHeaders = (
  headers: Headers,
  plainToken: string,
  maxAgeSeconds: number,
  opts?: { secure?: boolean },
): void => {
  headers.append("Set-Cookie", buildResumeClearRootCookieValue(opts));
  headers.append("Set-Cookie", buildResumeSetCookieValue(plainToken, maxAgeSeconds, opts));
};

export const buildResumeCookieHeaders = (
  plainToken: string,
  maxAgeSeconds: number,
  opts?: { secure?: boolean },
): Headers => {
  const headers = new Headers();
  appendResumeSetCookieHeaders(headers, plainToken, maxAgeSeconds, opts);
  return headers;
};

export const readResumeTokensFromRequestCookies = (
  cookieHeader: string | null,
  name: string = RESUME_COOKIE_NAME,
): string[] => {
  if (!cookieHeader?.trim()) return [];
  const pairs = cookieHeader.split(";").map((p) => p.trim());
  const prefix = `${name}=`;
  const tokens: string[] = [];
  for (const p of pairs) {
    if (!p.startsWith(prefix)) continue;
    const raw = p.slice(prefix.length);
    try {
      tokens.push(decodeURIComponent(raw));
    } catch {
      tokens.push(raw);
    }
  }
  return tokens;
};

export const readResumeTokenFromRequestCookies = (
  cookieHeader: string | null,
  name: string = RESUME_COOKIE_NAME,
): string | null => readResumeTokensFromRequestCookies(cookieHeader, name)[0] ?? null;

