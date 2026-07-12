import { relations, sql } from "drizzle-orm";
import { date, integer, numeric, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { lessons, questions } from "./content";

/**
 * Record of a user finishing a lesson, scoring it and earning XP.
 */
export const lessonCompletions = pgTable("lesson_completions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  xp: integer("xp").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LessonCompletionRow = typeof lessonCompletions.$inferSelect;

export type LessonCompletionInsertRow = typeof lessonCompletions.$inferInsert;

/**
 * Per-(user, question) spaced-repetition state persisted between reviews.
 */
export const userQuestionStates = pgTable("user_question_states", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  repetitions: integer("repetitions").notNull().default(0),
  intervalDays: integer("interval_days").notNull().default(0),
  easeFactor: numeric("ease_factor", { precision: 3, scale: 2 }).notNull().default("2.50"),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  nextReviewAt: timestamp("next_review_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserQuestionStateRow = typeof userQuestionStates.$inferSelect;

export type UserQuestionStateInsertRow = typeof userQuestionStates.$inferInsert;

/**
 * Aggregate gamification stats per user (single row per user via unique userId).
 */
export const userStats = pgTable("user_stats", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  totalXp: integer("total_xp").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityDate: date("last_activity_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserStatRow = typeof userStats.$inferSelect;

export type UserStatInsertRow = typeof userStats.$inferInsert;

/**
 * Daily streak ping per user. The (user_id, activity_date) pair is unique
 * so anti-cheat streak validation relies on server-provided dates only.
 */
export const dailyActivity = pgTable(
  "daily_activity",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityDate: date("activity_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("daily_activity_user_date_unique").on(table.userId, table.activityDate)],
);

export type DailyActivityRow = typeof dailyActivity.$inferSelect;

export type DailyActivityInsertRow = typeof dailyActivity.$inferInsert;

export const lessonCompletionsRelations = relations(lessonCompletions, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonCompletions.lessonId],
    references: [lessons.id],
  }),
  user: one(users, { fields: [lessonCompletions.userId], references: [users.id] }),
}));

export const userQuestionStatesRelations = relations(userQuestionStates, ({ one }) => ({
  question: one(questions, {
    fields: [userQuestionStates.questionId],
    references: [questions.id],
  }),
  user: one(users, { fields: [userQuestionStates.userId], references: [users.id] }),
}));

export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(users, { fields: [userStats.userId], references: [users.id] }),
}));

export const dailyActivityRelations = relations(dailyActivity, ({ one }) => ({
  user: one(users, { fields: [dailyActivity.userId], references: [users.id] }),
}));
