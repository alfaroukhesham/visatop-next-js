/** Skip must save the party insurance tick as off before Pay. */
export const skipExtrasSave = (
  patchTrip: ((patch: { insuranceForParty: false }) => Promise<boolean>) | undefined,
): Promise<boolean> => (patchTrip ? patchTrip({ insuranceForParty: false }) : Promise.resolve(false));

export const continueWithoutExtras = async (
  saveUnticked: () => Promise<boolean>,
  goToPay: () => void,
): Promise<boolean> => {
  const saved = await saveUnticked();
  if (!saved) return false;
  goToPay();
  return true;
};
