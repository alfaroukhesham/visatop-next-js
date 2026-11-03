import { asc, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const loadPartyMemberIds = async (tx: DbTransaction, applicationId: string): Promise<string[] | null> => {
  const [requestedApp] = await tx
    .select({
      id: schema.application.id,
      partyId: schema.application.partyId,
    })
    .from(schema.application)
    .where(eq(schema.application.id, applicationId))
    .limit(1);
  if (!requestedApp) return null;
  if (!requestedApp.partyId) return [requestedApp.id];
  const members = await tx
    .select({ id: schema.application.id })
    .from(schema.application)
    .where(eq(schema.application.partyId, requestedApp.partyId))
    .orderBy(asc(schema.application.travelerIndex));
  return members.map((m) => m.id);
};
