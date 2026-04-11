import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

/**
 * Admin identity tables are intentionally separate from client identity tables.
 * This keeps admin-only auth policies (e.g. 2FA) isolated and simplifies access
 * control across `/admin/*` vs `/portal/*`.
 */
export const adminUser = pgTable("admin_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const adminSession = pgTable(
  "admin_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => adminUser.id, { onDelete: "cascade" }),
  },
  (table) => [index("admin_session_userId_idx").on(table.userId)],
);

export const adminAccount = pgTable(
  "admin_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => adminUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("admin_account_userId_idx").on(table.userId)],
);

export const adminVerification = pgTable(
  "admin_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("admin_verification_identifier_idx").on(table.identifier)],
);

export const adminUserRelations = relations(adminUser, ({ many }) => ({
  sessions: many(adminSession),
  accounts: many(adminAccount),
}));

export const adminSessionRelations = relations(adminSession, ({ one }) => ({
  user: one(adminUser, {
    fields: [adminSession.userId],
    references: [adminUser.id],
  }),
}));

export const adminAccountRelations = relations(adminAccount, ({ one }) => ({
  user: one(adminUser, {
    fields: [adminAccount.userId],
    references: [adminUser.id],
  }),
}));

