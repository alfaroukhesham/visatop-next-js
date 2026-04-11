import pino from "pino";

const redactPaths = [
  // Auth / session
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers.set-cookie",
  "res.headers.set-cookie",
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",

  // Common PII / documents (defensive)
  "*.passport*",
  "*.document*",
  "*.ocr*",
  "*.extraction*",
  "*.pii*",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: {
    paths: redactPaths,
    censor: "[redacted]",
    remove: false,
  },
  base: undefined,
});

