const isFincraCheckoutHostname = (hostname: string): boolean => {
  const host = hostname.trim().toLowerCase();
  return host === "checkout.fincra.com" || host.endsWith(".checkout.fincra.com");
};

export const isTrustedFincraCheckoutUrl = (raw: string): boolean => {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && isFincraCheckoutHostname(url.hostname);
  } catch {
    return false;
  }
};

export const fincraCheckoutUrlFromPayCode = (payCode: string): string => {
  const code = payCode.trim();
  return `https://checkout.fincra.com/pay/${encodeURIComponent(code)}`;
};
