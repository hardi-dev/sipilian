import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * Stores the response of an idempotent mutation keyed by (user, key) so retries
 * return the original result instead of re-applying the effect.
 */
export const requestIdempotency = pgTable(
  "request_idempotency",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    response: jsonb("response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("request_idempotency_user_key_unique").on(table.userId, table.key)],
);

export type RequestIdempotencyRow = typeof requestIdempotency.$inferSelect;

export type RequestIdempotencyInsertRow = typeof requestIdempotency.$inferInsert;
