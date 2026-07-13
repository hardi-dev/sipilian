import { db as _typeAnchor } from "@sipilian/db";
import {
  lessonQuestions,
  lessons,
  questionOptions,
  questions,
  subtests,
  topics,
  tryoutPackageQuestions,
  tryoutPackages,
  units,
  users,
} from "@sipilian/db/schema";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import type { RequestContext } from "./context";

type Database = typeof _typeAnchor;

/**
 * Identifiers created by seedContent, needed for assertions and cleanup.
 */
export interface SeededContent {
  readonly userId: string;
  readonly subtestId: string;
  readonly lessonId: string;
  readonly questionIds: readonly string[];
  readonly correctOptionByQuestion: Readonly<Record<string, string>>;
  readonly packageId: string;
}

interface HierarchyIds {
  readonly userId: string;
  readonly subtestId: string;
  readonly topicId: string;
  readonly lessonId: string;
}

interface QuestionWithOptions {
  readonly questionId: string;
  readonly rightOptionId: string;
}

/**
 * Asserts a Drizzle returning row is defined.
 * @param row - The potentially undefined row from a returning() call.
 * @param label - Label for the error message.
 * @returns The confirmed row.
 */
function requireRow<T>(row: T | undefined, label: string): T {
  if (row === undefined) {
    throw new Error(`Row not created: ${label}`);
  }

  return row;
}

/**
 * Builds a RequestContext for tests with a fixed server clock.
 * @param database - The shared Drizzle instance.
 * @param userId - The acting user's id.
 * @returns A RequestContext with now pinned to a deterministic date.
 */
export function testContext(database: Database, userId: string): RequestContext {
  return { userId, db: database, now: new Date("2026-07-13T00:00:00Z") };
}

/**
 * Inserts a single question row.
 * @param database - The shared Drizzle instance.
 * @param topicId - The parent topic id.
 * @param stem - The question stem text.
 * @returns The new question's id.
 */
async function insertQuestion(
  database: Database,
  topicId: string,
  stem: string,
): Promise<string> {
  const [row] = await database
    .insert(questions)
    .values({ topicId, type: "multiple_choice", status: "published", difficulty: 1, stem })
    .returning();

  return requireRow(row, "question").id;
}

/**
 * Inserts the correct (right) answer option for a question.
 * @param database - The shared Drizzle instance.
 * @param questionId - The parent question id.
 * @returns The new option's id.
 */
async function insertCorrectOption(database: Database, questionId: string): Promise<string> {
  const [row] = await database
    .insert(questionOptions)
    .values({ questionId, label: "A", text: "right", isCorrect: true, order: 1 })
    .returning();

  return requireRow(row, "option").id;
}

/**
 * Inserts a wrong answer option for a question.
 * @param database - The shared Drizzle instance.
 * @param questionId - The parent question id.
 */
async function insertWrongOption(database: Database, questionId: string): Promise<void> {
  await database
    .insert(questionOptions)
    .values({ questionId, label: "B", text: "wrong", isCorrect: false, order: 2 });
}

/**
 * Links a question to a lesson preserving order.
 * @param database - The shared Drizzle instance.
 * @param lessonId - The lesson id.
 * @param questionId - The question id.
 * @param order - The display order within the lesson.
 */
async function seedLessonQuestion(
  database: Database,
  lessonId: string,
  questionId: string,
  order: number,
): Promise<void> {
  await database
    .insert(lessonQuestions)
    .values({ lessonId, questionId, order });
}

/**
 * Inserts a single test user row.
 * @param database - The shared Drizzle instance.
 * @returns The new user's id.
 */
async function seedUser(database: Database): Promise<string> {
  const tag = randomUUID().replace(/-/g, "").slice(0, 12);
  const [row] = await database
    .insert(users)
    .values({
      id: sql`gen_random_uuid()`,
      name: "API Test",
      email: `api-${tag}@example.com`,
    })
    .returning();

  return requireRow(row, "user").id;
}

/**
 * Inserts a single TWK subtest row.
 * @param database - The shared Drizzle instance.
 * @returns The new subtest's id.
 */
async function seedSubtest(database: Database): Promise<string> {
  const tag = randomUUID().replace(/-/g, "").slice(0, 8);
  const [row] = await database
    .insert(subtests)
    .values({ slug: `twk-${tag}`, name: "TWK", passingGrade: 65 })
    .returning();

  return requireRow(row, "subtest").id;
}

/**
 * Inserts a topic row linked to the given subtest.
 * @param database - The shared Drizzle instance.
 * @param subtestId - The parent subtest id.
 * @returns The new topic's id.
 */
async function seedTopic(database: Database, subtestId: string): Promise<string> {
  const [row] = await database
    .insert(topics)
    .values({ subtestId, slug: "nasionalisme", name: "Nasionalisme" })
    .returning();

  return requireRow(row, "topic").id;
}

/**
 * Inserts a unit row linked to the given topic.
 * @param database - The shared Drizzle instance.
 * @param topicId - The parent topic id.
 * @returns The new unit's id.
 */
async function seedUnit(database: Database, topicId: string): Promise<string> {
  const [row] = await database
    .insert(units)
    .values({ topicId, slug: "u1", name: "Unit 1", order: 1 })
    .returning();

  return requireRow(row, "unit").id;
}

/**
 * Inserts a lesson row linked to the given unit.
 * @param database - The shared Drizzle instance.
 * @param unitId - The parent unit id.
 * @returns The new lesson's id.
 */
async function seedLesson(database: Database, unitId: string): Promise<string> {
  const [row] = await database
    .insert(lessons)
    .values({ unitId, slug: "l1", name: "Lesson 1", order: 1 })
    .returning();

  return requireRow(row, "lesson").id;
}

/**
 * Seeds the full hierarchy: user → subtest → topic → unit → lesson.
 * @param database - The shared Drizzle instance.
 * @returns The hierarchy ids.
 */
async function seedHierarchy(database: Database): Promise<HierarchyIds> {
  const userId = await seedUser(database);
  const subtestId = await seedSubtest(database);
  const topicId = await seedTopic(database, subtestId);
  const unitId = await seedUnit(database, topicId);
  const lessonId = await seedLesson(database, unitId);

  return { userId, subtestId, topicId, lessonId };
}

/**
 * Creates one question with a correct and wrong answer option.
 * @param database - The shared Drizzle instance.
 * @param topicId - The parent topic id.
 * @param stem - The question stem text.
 * @returns The question id and the correct option id.
 */
async function seedOneQuestionWithOptions(
  database: Database,
  topicId: string,
  stem: string,
): Promise<QuestionWithOptions> {
  const questionId = await insertQuestion(database, topicId, stem);
  const rightOptionId = await insertCorrectOption(database, questionId);

  await insertWrongOption(database, questionId);

  return { questionId, rightOptionId };
}

/**
 * Creates a tryout package and links the given questions.
 * @param database - The shared Drizzle instance.
 * @param questionIds - The questions to include in the package.
 * @returns The new package's id.
 */
async function seedPackage(database: Database, questionIds: string[]): Promise<string> {
  const tag = randomUUID().replace(/-/g, "").slice(0, 8);
  const [pkg] = await database
    .insert(tryoutPackages)
    .values({
      slug: `skd-${tag}`,
      name: "Tryout",
      durationMinutes: 100,
      composition: { twk: 2, tiu: 0, tkp: 0 },
    })
    .returning();
  const packageId = requireRow(pkg, "package").id;

  for (const [order, questionId] of questionIds.entries()) {
    await database
      .insert(tryoutPackageQuestions)
      .values({ packageId, questionId, order: order + 1 });
  }

  return packageId;
}

/**
 * Seeds two objective questions with options, links them to the lesson and a package.
 * @param database - The shared Drizzle instance.
 * @param ids - The parent hierarchy ids.
 * @returns The full seeded identifier set.
 */
async function seedQuestions(
  database: Database,
  ids: HierarchyIds,
): Promise<SeededContent> {
  const questionIds: string[] = [];
  const correctOptionByQuestion: Record<string, string> = {};

  for (let index = 0; index < 2; index += 1) {
    const result = await seedOneQuestionWithOptions(
      database,
      ids.topicId,
      `Q${index.toString()}`,
    );

    await seedLessonQuestion(database, ids.lessonId, result.questionId, index + 1);

    questionIds.push(result.questionId);
    correctOptionByQuestion[result.questionId] = result.rightOptionId;
  }

  const packageId = await seedPackage(database, questionIds);

  return { ...ids, questionIds, correctOptionByQuestion, packageId };
}

/**
 * Seeds a minimal TWK learning path + tryout package + a test user.
 * @param database - The shared Drizzle instance.
 * @returns The identifiers of the seeded rows.
 */
export async function seedContent(database: Database): Promise<SeededContent> {
  const hierarchy = await seedHierarchy(database);

  return seedQuestions(database, hierarchy);
}

/**
 * Deletes the seeded user (cascades sessions/progress) and content rows.
 * @param database - The shared Drizzle instance.
 * @param seeded - The identifiers returned by seedContent.
 * @returns Nothing; resolves once all rows are removed.
 */
export async function cleanup(database: Database, seeded: SeededContent): Promise<void> {
  await database.delete(users).where(eq(users.id, seeded.userId));
  await database.delete(subtests).where(eq(subtests.id, seeded.subtestId));
  await database.delete(tryoutPackages).where(eq(tryoutPackages.id, seeded.packageId));
}
