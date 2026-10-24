export const GUEST_EMAIL_REJECTED_MESSAGE =
  "Enter a real email address we can use to send your application updates.";

const BLOCKED_HOSTS = new Set([
  "example.com",
  "example.net",
  "example.org",
  "example.edu",
  "test.com",
  "test.net",
  "test.org",
]);

const BLOCKED_TLDS = new Set(["test", "example", "invalid", "localhost"]);
const BLOCKED_LABELS = new Set(["example", "test", "invalid", "localhost"]);

const looksLikeEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isPlausibleGuestEmail = (raw: string): boolean => {
  const email = raw.trim().toLowerCase();
  if (!looksLikeEmail(email) || email.length > 320) return false;
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length < 2) return false;
  const labels = domain.split(".").filter(Boolean);
  if (labels.length < 2) return false;
  const nameLabels = labels.slice(0, -1);
  if (nameLabels.some((label) => label.length < 2)) return false;
  const tld = labels[labels.length - 1] ?? "";
  if (BLOCKED_TLDS.has(tld)) return false;
  if (BLOCKED_HOSTS.has(domain) || [...BLOCKED_HOSTS].some((host) => domain.endsWith(`.${host}`))) {
    return false;
  }
  if (labels.some((label) => BLOCKED_LABELS.has(label))) return false;
  return true;
};
