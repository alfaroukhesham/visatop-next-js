export const paymentProviderLabel = (provider: string | null | undefined): string => {
  const p = (provider ?? "").trim().toLowerCase();
  if (p === "ziina") return "Ziina";
  if (p === "fincra") return "Fincra";
  if (p === "paddle") return "Paddle";
  return provider?.trim() || "VisaTop";
};
