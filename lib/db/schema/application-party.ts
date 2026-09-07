import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { nationality } from "./visa";

export const TRAVELER_ROLE = { PRIMARY: "primary", ADDITIONAL: "additional" } as const;

export const applicationParty = pgTable(
  "application_party",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    isGuest: boolean("is_guest").default(true).notNull(),
    guestEmail: text("guest_email"),
    nationalityCode: text("nationality_code")
      .notNull()
      .references(() => nationality.code),
    catalogCurrency: text("catalog_currency").default("USD").notNull(),
    resumeTokenHash: text("resume_token_hash"),
    draftExpiresAt: timestamp("draft_expires_at"),
    paymentStatus: text("payment_status").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("application_party_resumeTokenHash_idx").on(t.resumeTokenHash),
    uniqueIndex("application_party_resume_token_hash_uidx").on(t.resumeTokenHash),
    index("application_party_guestEmail_idx").on(t.guestEmail),
  ],
);
