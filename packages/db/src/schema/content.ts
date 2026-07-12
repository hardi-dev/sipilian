import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Question display/grading type (MVP: only pilihan ganda).
 */
export const questionTypeEnum = pgEnum("question_type", ["multiple_choice"]);

/**
 * Lifecycle status of a question row.
 */
export const questionStatusEnum = pgEnum("question_status", ["draft", "published"]);

/**
 * Subtest kinds (TWK, TIU, TKP) along with passing-grade metadata.
 */
export const subtests = pgTable("subtests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  passingGrade: integer("passing_grade").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SubtestRow = typeof subtests.$inferSelect;

export type SubtestInsertRow = typeof subtests.$inferInsert;

/**
 * Topic subdivisions within a subtest (e.g. TWK -> Nasionalisme).
 */
export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  subtestId: uuid("subtest_id")
    .notNull()
    .references(() => subtests.id, { onDelete: "cascade" }),
  slug: varchar("slug", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TopicRow = typeof topics.$inferSelect;

export type TopicInsertRow = typeof topics.$inferInsert;

/**
 * Ordered unit groups within a topic forming the learning path.
 */
export const units = pgTable("units", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  slug: varchar("slug", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UnitRow = typeof units.$inferSelect;

export type UnitInsertRow = typeof units.$inferInsert;

/**
 * Bite-sized lessons (5-10 questions) making up a unit.
 */
export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "cascade" }),
  slug: varchar("slug", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LessonRow = typeof lessons.$inferSelect;

export type LessonInsertRow = typeof lessons.$inferInsert;

/**
 * Question stems tagged to a topic; can appear in many lessons.
 */
export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  type: questionTypeEnum("type").notNull(),
  status: questionStatusEnum("status").notNull().default("draft"),
  difficulty: integer("difficulty").notNull(),
  stem: text("stem").notNull(),
  explanation: text("explanation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuestionRow = typeof questions.$inferSelect;

export type QuestionInsertRow = typeof questions.$inferInsert;

/**
 * Answer options per question.
 * `is_correct` is used for TWK/TIU; `weight` (1..5) for TKP.
 */
export const questionOptions = pgTable("question_options", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 4 }).notNull(),
  text: text("text").notNull(),
  isCorrect: boolean("is_correct"),
  weight: integer("weight"),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuestionOptionRow = typeof questionOptions.$inferSelect;

export type QuestionOptionInsertRow = typeof questionOptions.$inferInsert;

/**
 * Many-to-many relation between lessons and questions, preserving lesson order.
 */
export const lessonQuestions = pgTable(
  "lesson_questions",
  {
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.lessonId, table.questionId] })],
);

export type LessonQuestionRow = typeof lessonQuestions.$inferSelect;

export type LessonQuestionInsertRow = typeof lessonQuestions.$inferInsert;

export const subtestsRelations = relations(subtests, ({ many }) => ({
  topics: many(topics),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  subtest: one(subtests, { fields: [topics.subtestId], references: [subtests.id] }),
  units: many(units),
}));

export const unitsRelations = relations(units, ({ one, many }) => ({
  topic: one(topics, { fields: [units.topicId], references: [topics.id] }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  unit: one(units, { fields: [lessons.unitId], references: [units.id] }),
  lessonQuestions: many(lessonQuestions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  topic: one(topics, { fields: [questions.topicId], references: [topics.id] }),
  options: many(questionOptions),
  lessonQuestions: many(lessonQuestions),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  question: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id],
  }),
}));

export const lessonQuestionsRelations = relations(lessonQuestions, ({ one }) => ({
  lesson: one(lessons, { fields: [lessonQuestions.lessonId], references: [lessons.id] }),
  question: one(questions, {
    fields: [lessonQuestions.questionId],
    references: [questions.id],
  }),
}));
