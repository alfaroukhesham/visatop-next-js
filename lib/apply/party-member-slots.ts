import { resolveDocumentRequirements, type TDocumentSlot } from "@/lib/apply/document-requirements";

type TMemberWithSlots = {
  applicationId: string;
  slots: TDocumentSlot[];
};

export const slotsForPartyMember = (
  members: TMemberWithSlots[],
  memberId: string,
): TDocumentSlot[] =>
  members.find((m) => m.applicationId === memberId)?.slots ?? resolveDocumentRequirements([]);
