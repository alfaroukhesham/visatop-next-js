import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { adminUser } from "./admin-auth";

export const adminPermission = pgTable(
  "admin_permission",
  {
    key: text("key").primaryKey(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("admin_permission_key_uidx").on(t.key)],
);

export const adminRole = pgTable(
  "admin_role",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("admin_role_name_uidx").on(t.name)],
);

export const adminRolePermission = pgTable(
  "admin_role_permission",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => adminRole.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => adminPermission.key, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("admin_role_permission_uidx").on(t.roleId, t.permissionKey),
    index("admin_role_permission_roleId_idx").on(t.roleId),
    index("admin_role_permission_permissionKey_idx").on(t.permissionKey),
  ],
);

export const adminUserRole = pgTable(
  "admin_user_role",
  {
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => adminUser.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => adminRole.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("admin_user_role_uidx").on(t.adminUserId, t.roleId),
    index("admin_user_role_adminUserId_idx").on(t.adminUserId),
    index("admin_user_role_roleId_idx").on(t.roleId),
  ],
);

export const adminRoleRelations = relations(adminRole, ({ many }) => ({
  rolePermissions: many(adminRolePermission),
  userRoles: many(adminUserRole),
}));

export const adminPermissionRelations = relations(adminPermission, ({ many }) => ({
  rolePermissions: many(adminRolePermission),
}));

export const adminRolePermissionRelations = relations(
  adminRolePermission,
  ({ one }) => ({
    role: one(adminRole, {
      fields: [adminRolePermission.roleId],
      references: [adminRole.id],
    }),
    permission: one(adminPermission, {
      fields: [adminRolePermission.permissionKey],
      references: [adminPermission.key],
    }),
  }),
);

export const adminUserRoleRelations = relations(adminUserRole, ({ one }) => ({
  user: one(adminUser, {
    fields: [adminUserRole.adminUserId],
    references: [adminUser.id],
  }),
  role: one(adminRole, {
    fields: [adminUserRole.roleId],
    references: [adminRole.id],
  }),
}));

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    actorType: text("actor_type").notNull(), // admin|client|system
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("audit_log_actor_idx").on(t.actorType, t.actorId),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_createdAt_idx").on(t.createdAt),
  ],
);

