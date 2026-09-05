export const nationalityDisplayName = (
  code: string,
  catalog: Array<{ code: string; name: string }>,
): string => {
  const upper = code.trim().toUpperCase();
  return catalog.find((n) => n.code.toUpperCase() === upper)?.name ?? upper;
};

export const serviceDisplayName = (
  serviceId: string,
  catalog: Array<{ id: string; name: string }>,
): string | null => {
  const hit = catalog.find((s) => s.id === serviceId);
  return hit?.name ?? null;
};
