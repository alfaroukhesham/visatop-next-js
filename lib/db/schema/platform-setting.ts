import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Key/value platform configuration (admin-editable where exposed).
 * RLS is defined in SQL migrations (not expressible in Drizzle schema alone).
 */
export const platformSetting = pgTable("platform_setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
