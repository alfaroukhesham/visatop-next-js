export const firstNameFromFullName = (fullName: string | null | undefined): string | null => {
  const first = fullName?.trim().split(/\s+/).find(Boolean);
  return first ?? null;
};
