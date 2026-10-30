import { isSpanContextValid, trace } from "@opentelemetry/api";
import pino, { type DestinationStream, type Logger } from "pino";

export const LOG_REDACT_CENSOR = "[redacted]" as const;

const piiKeys = [
  "email",
  "guestEmail",
  "fullName",
  "firstName",
  "lastName",
  "name",
  "passportNumber",
  "phone",
  "address",
  "dateOfBirth",
  "token",
  "tokens",
  "accessToken",
  "access_token",
  "capiToken",
  "metaCapiToken",
  "refreshToken",
  "idToken",
  "fbp",
  "fbc",
  "fbclid",
  "clientIp",
  "client_ip_address",
  "cookie",
  "cookies",
  "set-cookie",
  "authorization",
  "password",
  "rawBody",
  "bodyText",
  "rawPayload",
  "webhookPayload",
] as const;

const PII_KEY_SET = new Set<string>(piiKeys);

const nestedAndTop = (key: string): string[] => [key, `*.${key}`];

export const LOGGER_REDACT_PATHS: string[] = [
  ...piiKeys.flatMap(nestedAndTop),

  // Auth headers (req/res shaped objects)
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers.set-cookie",
  "res.headers.set-cookie",
  "headers.authorization",
  "headers.cookie",
  "headers.set-cookie",
  "*.headers.authorization",
  "*.headers.cookie",
  "*.headers.set-cookie",

  // Common PII / documents (defensive globs; keep existing coverage)
  "*.passport*",
  "*.document*",
  "*.ocr*",
  "*.extraction*",
  "*.pii*",
];

const GLOB_KEY_RE = [
  /passport/i,
  /ocr/i,
  /extraction/i,
  /^pii/i,
  /document(?!Id|Type)/i,
];

export const shouldRedactLogKey = (key: string): boolean => {
  if (PII_KEY_SET.has(key)) return true;
  return GLOB_KEY_RE.some((re) => re.test(key));
};

export const redactLogValue = (value: unknown, depth = 0): unknown => {
  if (value instanceof Error) return value;
  if (value === null || typeof value !== "object") return value;
  if (depth > 8) return value;
  if (Array.isArray(value)) return value.map((entry) => redactLogValue(entry, depth + 1));
  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(input)) {
    out[key] = shouldRedactLogKey(key) ? LOG_REDACT_CENSOR : redactLogValue(nested, depth + 1);
  }
  return out;
};

export const resolveLogEnv = (): string => {
  const appEnv = process.env.APP_ENV?.trim();
  return appEnv || "unknown";
};

export const resolveReleaseSha = (): string => {
  const sha =
    process.env.GIT_SHA?.trim() ||
    process.env.GIT_COMMIT_SHA?.trim() ||
    process.env.SOURCE_VERSION?.trim();
  return sha || "unknown";
};

export const resolveServiceName = (): string =>
  process.env.OTEL_SERVICE_NAME?.trim() || "visatop-next-js";

const readActiveSpanBindings = (): { traceId?: string; spanId?: string } => {
  const span = trace.getActiveSpan();
  const spanContext = span?.spanContext();
  if (!spanContext || !isSpanContextValid(spanContext)) return {};
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
};

export const createAppLogger = (destination?: DestinationStream): Logger =>
  pino(
    {
      level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
      redact: {
        paths: LOGGER_REDACT_PATHS,
        censor: LOG_REDACT_CENSOR,
        remove: false,
      },
      base: {
        service: resolveServiceName(),
        env: resolveLogEnv(),
        release: resolveReleaseSha(),
      },
      mixin: () => readActiveSpanBindings(),
      hooks: {
        logMethod(inputArgs, method) {
          if (inputArgs.length > 0 && typeof inputArgs[0] === "object" && inputArgs[0] !== null) {
            inputArgs[0] = redactLogValue(inputArgs[0]);
          }
          return method.apply(this, inputArgs);
        },
      },
    },
    destination,
  );

export const logger = createAppLogger();

export const createRequestLogger = (requestId?: string | null, parent: Logger = logger): Logger => {
  const bindings: Record<string, string> = { ...readActiveSpanBindings() };
  const trimmed = requestId?.trim();
  if (trimmed) bindings.requestId = trimmed;
  return parent.child(bindings);
};
