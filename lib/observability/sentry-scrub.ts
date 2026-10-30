const FILTERED = "[Filtered]";

const PII_KEY_RE =
  /^(email|guestemail|useremail|name|fullname|firstname|lastname|givenname|surname|familyname|passport|passportnumber|passportno|phone|telephone|mobile|phonenumber|dob|dateofbirth|birthdate|date_of_birth|ip_address|ipaddress|username|token|tokens|accesstoken|capitoken|metacapitoken|fbp|fbc|fbclid|useragent|clientip|clientipaddress|clientuseragent)$/i;

const REQUEST_STRIP_KEYS = new Set(["data", "cookies", "headers", "query_string", "env", "body"]);

export type TSentryEventLike = {
  request?: {
    url?: string;
    method?: string;
    data?: unknown;
    cookies?: unknown;
    headers?: unknown;
    query_string?: unknown;
    env?: unknown;
    body?: unknown;
  };
  user?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, string | number | boolean | bigint | symbol | null | undefined>;
  breadcrumbs?: Array<{ data?: Record<string, unknown>; message?: string }>;
  transaction?: string;
  type?: string;
  message?: string;
  [key: string]: unknown;
};

const normalizeKey = (key: string): string => key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const isPiiKey = (key: string): boolean => PII_KEY_RE.test(normalizeKey(key));

const redactDeep = (value: unknown, parentKey?: string): unknown => {
  if (parentKey && isPiiKey(parentKey)) return FILTERED;
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = redactDeep(child, key);
    }
    return out;
  }
  return value;
};

const scrubRequest = (
  request: TSentryEventLike["request"],
): TSentryEventLike["request"] => {
  if (!request) return request;
  const next: NonNullable<TSentryEventLike["request"]> = {};
  if (request.url) next.url = request.url;
  if (request.method) next.method = request.method;
  for (const [key, value] of Object.entries(request)) {
    if (key === "url" || key === "method") continue;
    if (REQUEST_STRIP_KEYS.has(key)) continue;
    (next as Record<string, unknown>)[key] = redactDeep(value, key);
  }
  return next;
};

export const scrubSentryEvent = <T extends TSentryEventLike>(event: T): T => {
  const next: TSentryEventLike = { ...event };
  if (event.request) next.request = scrubRequest(event.request);
  if (event.user) next.user = redactDeep(event.user) as Record<string, unknown>;
  if (event.extra) next.extra = redactDeep(event.extra) as Record<string, unknown>;
  if (event.contexts) next.contexts = redactDeep(event.contexts) as Record<string, unknown>;
  if (event.breadcrumbs) {
    next.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      data: crumb.data
        ? (redactDeep(crumb.data) as Record<string, unknown>)
        : crumb.data,
    }));
  }
  return next as T;
};
