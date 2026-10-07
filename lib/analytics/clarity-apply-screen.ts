/** Tag the current apply screen so Clarity recordings can be filtered. No personal data. */
export const tagClarityApplyScreen = (screen: string): void => {
  if (typeof window === "undefined") return;
  const clarity = (window as unknown as { clarity?: (...args: unknown[]) => void }).clarity;
  if (typeof clarity !== "function") return;
  clarity("set", "apply_screen", screen);
};
