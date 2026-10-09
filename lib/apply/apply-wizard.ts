export const APPLY_WIZARD_SCREENS = ["ready", "passport", "other", "details"] as const;

export type TApplyWizardScreen = (typeof APPLY_WIZARD_SCREENS)[number];

export type TApplyStopScreen = TApplyWizardScreen | "pay";

export type TApplyWizardMember = {
  applicationId: string;
  hasPassport: boolean;
};

export type TApplyWizardCursor = {
  screen: TApplyWizardScreen;
  travellerId: string | null;
};

export type TApplyWizardStep = {
  screen: TApplyWizardScreen;
  travellerId: string | null;
};

export type TResolvedApplyScreen = TApplyWizardStep | { screen: "payment"; travellerId: null };

export type TApplyWizardRequest = {
  screen: TApplyWizardScreen;
  travellerId: string | null;
};

const isWizardScreen = (value: string): value is TApplyWizardScreen =>
  (APPLY_WIZARD_SCREENS as readonly string[]).includes(value);

export const wizardStepsForMembers = (members: TApplyWizardMember[]): TApplyWizardStep[] => {
  const steps: TApplyWizardStep[] = [{ screen: "ready", travellerId: null }];
  for (const member of members) {
    steps.push({ screen: "passport", travellerId: member.applicationId });
    steps.push({ screen: "other", travellerId: member.applicationId });
    steps.push({ screen: "details", travellerId: member.applicationId });
  }
  return steps;
};

const sameStep = (step: TApplyWizardStep, screen: TApplyWizardScreen, travellerId: string | null): boolean =>
  step.screen === screen && step.travellerId === travellerId;

const stepIndex = (
  steps: TApplyWizardStep[],
  screen: TApplyWizardScreen,
  travellerId: string | null,
): number => steps.findIndex((step) => sameStep(step, screen, travellerId));

const missingPassportIndex = (members: TApplyWizardMember[]): number =>
  members.findIndex((member) => !member.hasPassport);

const stepBlocked = (members: TApplyWizardMember[], step: TApplyWizardStep): boolean => {
  if (step.screen === "ready") return false;
  const memberIndex = members.findIndex((member) => member.applicationId === step.travellerId);
  if (memberIndex < 0) return true;
  const gap = missingPassportIndex(members);
  if (gap >= 0 && gap < memberIndex) return true;
  if (step.screen !== "passport" && !members[memberIndex]!.hasPassport) return true;
  return false;
};

export const parseApplyWizardQuery = (
  screen: string | null | undefined,
  traveller: string | null | undefined,
): TApplyWizardRequest | null => {
  if (!screen || !isWizardScreen(screen)) return null;
  if (screen === "ready") return { screen, travellerId: null };
  const travellerId = traveller?.trim() ? traveller.trim() : null;
  return { screen, travellerId };
};

export const resolveApplyScreen = (input: {
  members: TApplyWizardMember[];
  cursor: TApplyWizardCursor | null;
  requested: TApplyWizardRequest | null;
}): TResolvedApplyScreen => {
  if (input.members.length === 0) return { screen: "ready", travellerId: null };
  const steps = wizardStepsForMembers(input.members);
  const confirmedIdx = input.cursor
    ? stepIndex(steps, input.cursor.screen, input.cursor.travellerId)
    : -1;
  const frontierIdx = confirmedIdx + 1;
  const maxIdx = Math.min(frontierIdx, steps.length - 1);
  let limit = maxIdx;
  for (let index = 0; index <= maxIdx; index += 1) {
    if (!stepBlocked(input.members, steps[index]!)) continue;
    const gap = missingPassportIndex(input.members);
    const gapId = gap >= 0 ? input.members[gap]!.applicationId : null;
    const passportIdx = gapId
      ? stepIndex(steps, "passport", gapId)
      : -1;
    limit = passportIdx >= 0 ? passportIdx : 0;
    break;
  }

  const paymentOpen =
    frontierIdx >= steps.length && limit === steps.length - 1 && !stepBlocked(input.members, steps[limit]!);

  if (input.requested) {
    if (input.requested.travellerId) {
      const requestedIdx = stepIndex(steps, input.requested.screen, input.requested.travellerId);
      if (
        requestedIdx >= 0 &&
        requestedIdx <= limit &&
        !stepBlocked(input.members, steps[requestedIdx]!)
      ) {
        return steps[requestedIdx]!;
      }
    } else {
      let found = -1;
      for (let index = 0; index <= limit; index += 1) {
        const step = steps[index]!;
        if (step.screen === input.requested.screen && !stepBlocked(input.members, step)) found = index;
      }
      if (found >= 0) return steps[found]!;
    }
  }

  if (paymentOpen && !input.requested) return { screen: "payment", travellerId: null };
  return steps[limit]!;
};

export const nextApplyScreen = (
  members: TApplyWizardMember[],
  current: TApplyWizardStep,
): TResolvedApplyScreen => {
  const steps = wizardStepsForMembers(members);
  const index = stepIndex(steps, current.screen, current.travellerId);
  if (index < 0 || index + 1 >= steps.length) return { screen: "payment", travellerId: null };
  return steps[index + 1]!;
};

/** Explicit previous step href — never the bare application URL (resume would bounce). */
export const previousApplyScreen = (
  members: TApplyWizardMember[],
  current: TResolvedApplyScreen,
): TResolvedApplyScreen | { screen: "home"; travellerId: null } => {
  const steps = wizardStepsForMembers(members);
  if (current.screen === "payment") {
    const last = steps[steps.length - 1];
    return last ?? { screen: "ready", travellerId: null };
  }
  const index = stepIndex(steps, current.screen, current.travellerId);
  if (index <= 0) return { screen: "home", travellerId: null };
  return steps[index - 1]!;
};

export const cursorIsAhead = (
  members: TApplyWizardMember[],
  previous: TApplyWizardCursor | null,
  next: TApplyWizardCursor,
): boolean => {
  const steps = wizardStepsForMembers(members);
  const previousIdx = previous ? stepIndex(steps, previous.screen, previous.travellerId) : -1;
  const nextIdx = stepIndex(steps, next.screen, next.travellerId);
  return nextIdx > previousIdx;
};

export const applyWizardHref = (applicationId: string, screen: TResolvedApplyScreen): string => {
  const id = encodeURIComponent(applicationId);
  if (screen.screen === "payment") return `/apply/applications/${id}/payment`;
  const params = new URLSearchParams();
  params.set("screen", screen.screen);
  if (screen.travellerId) params.set("traveller", screen.travellerId);
  return `/apply/applications/${id}?${params.toString()}`;
};

export const applyPreviousHref = (
  applicationId: string,
  members: TApplyWizardMember[],
  current: TResolvedApplyScreen,
): string => {
  const prev = previousApplyScreen(members, current);
  if (prev.screen === "home") return "/";
  return applyWizardHref(applicationId, prev);
};

/** Screen an unpaid application is sitting on, from the last confirmed cursor. */
export const abandonStopFromCursor = (input: {
  cursor: TApplyWizardCursor | null;
  lastTravellerId: string | null;
}): TApplyStopScreen => {
  if (!input.cursor || input.cursor.screen === "ready") {
    return input.cursor ? "passport" : "ready";
  }
  if (input.cursor.screen === "passport") return "other";
  if (input.cursor.screen === "other") return "details";
  if (
    input.cursor.travellerId &&
    input.lastTravellerId &&
    input.cursor.travellerId !== input.lastTravellerId
  ) {
    return "passport";
  }
  return "pay";
};
