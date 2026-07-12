import { relations, sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * Entitlement plan tiers used by the freemium model.
 */
export const entitlementPlanEnum = pgEnum("entitlement_plan", ["free", "premium"]);

/**
 * Per-user entitlement state. MVP: managed manually via admin; future plans
 * replace the manual setter with billing integration.
 */
export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: entitlementPlanEnum("plan").notNull().default("free"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("entitlements_user_id_unique").on(table.userId)],
);

export type EntitlementRow = typeof entitlements.$inferSelect;

export type EntitlementInsertRow = typeof entitlements.$inferInsert;

export const entitlementsRelations = relations(entitlements, ({ one }) => ({
  user: one(users, { fields: [entitlements.userId], references: [users.id] }),
}));
