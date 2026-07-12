import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { questions } from "./content";

/**
 * Composition of a tryout: number of questions per subtest.
 */
export interface CompositionShape {
  readonly twk: number;
  readonly tiu: number;
  readonly tkp: number;
}

/**
 * Headline metadata of a CAT tryout package.
 */
export const tryoutPackages = pgTable("tryout_packages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  composition: jsonb("composition").$type<CompositionShape>().notNull(),
  isFree: boolean("is_free").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TryoutPackageRow = typeof tryoutPackages.$inferSelect;

export type TryoutPackageInsertRow = typeof tryoutPackages.$inferInsert;

/**
 * Ordered list of questions making a tryout package.
 */
export const tryoutPackageQuestions = pgTable("tryout_package_questions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: uuid("package_id")
    .notNull()
    .references(() => tryoutPackages.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TryoutPackageQuestionRow = typeof tryoutPackageQuestions.$inferSelect;

export type TryoutPackageQuestionInsertRow = typeof tryoutPackageQuestions.$inferInsert;

/**
 * A user's attempt at a tryout package, scored per subtest.
 * `userId` references the auth `users` table (wired in Task 8).
 */
export const tryoutAttempts = pgTable("tryout_attempts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(),
  packageId: uuid("package_id")
    .notNull()
    .references(() => tryoutPackages.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  twkScore: integer("twk_score").notNull(),
  tiuScore: integer("tiu_score").notNull(),
  tkpScore: integer("tkp_score").notNull(),
  totalScore: integer("total_score").notNull(),
  passedAll: boolean("passed_all").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TryoutAttemptRow = typeof tryoutAttempts.$inferSelect;

export type TryoutAttemptInsertRow = typeof tryoutAttempts.$inferInsert;

/**
 * Per-question answer inside an attempt. `optionId` for TWK/TIU; `weight` for TKP.
 */
export const tryoutAnswers = pgTable("tryout_answers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => tryoutAttempts.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  optionId: uuid("option_id"),
  weight: integer("weight"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TryoutAnswerRow = typeof tryoutAnswers.$inferSelect;

export type TryoutAnswerInsertRow = typeof tryoutAnswers.$inferInsert;

export const tryoutPackagesRelations = relations(tryoutPackages, ({ many }) => ({
  packageQuestions: many(tryoutPackageQuestions),
  attempts: many(tryoutAttempts),
}));

export const tryoutPackageQuestionsRelations = relations(
  tryoutPackageQuestions,
  ({ one }) => ({
    pkg: one(tryoutPackages, {
      fields: [tryoutPackageQuestions.packageId],
      references: [tryoutPackages.id],
    }),
    question: one(questions, {
      fields: [tryoutPackageQuestions.questionId],
      references: [questions.id],
    }),
  }),
);

export const tryoutAttemptsRelations = relations(tryoutAttempts, ({ one, many }) => ({
  pkg: one(tryoutPackages, {
    fields: [tryoutAttempts.packageId],
    references: [tryoutPackages.id],
  }),
  answers: many(tryoutAnswers),
}));

export const tryoutAnswersRelations = relations(tryoutAnswers, ({ one }) => ({
  attempt: one(tryoutAttempts, {
    fields: [tryoutAnswers.attemptId],
    references: [tryoutAttempts.id],
  }),
  question: one(questions, {
    fields: [tryoutAnswers.questionId],
    references: [questions.id],
  }),
}));
