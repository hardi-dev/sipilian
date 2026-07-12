import { err, ok, type Result } from "@sipilian/core";
import {
  lessonQuestions,
  lessons,
  questionOptions,
  questions,
  subtests,
  topics,
  units,
} from "@sipilian/db/schema";
import { asc, eq, like } from "drizzle-orm";

import type { RequestContext } from "../context";
import { type ApiError, apiError } from "../http";
import type { GetLearningPathInput, GetLessonInput } from "./content.schema";

/**
 * A lesson entry within a learning path.
 */
export interface LearningPathLesson {
  readonly id: string;
  readonly name: string;
  readonly unitId: string;
  readonly order: number;
}

/**
 * The ordered lessons that make up a subtest's learning path.
 */
export interface LearningPath {
  readonly subtestKind: string;
  readonly lessons: readonly LearningPathLesson[];
}

/**
 * Returns the ordered lessons for a subtest, or not_found when the subtest is empty.
 * @param input - The subtest kind to load.
 * @param ctx - The request context.
 * @returns Ok with the learning path, or Err(not_found).
 */
export async function getLearningPath(
  input: GetLearningPathInput,
  ctx: RequestContext,
): Promise<Result<LearningPath, ApiError>> {
  const rows = await ctx.db
    .select({ id: lessons.id, name: lessons.name, unitId: lessons.unitId, order: lessons.order })
    .from(lessons)
    .innerJoin(units, eq(units.id, lessons.unitId))
    .innerJoin(topics, eq(topics.id, units.topicId))
    .innerJoin(subtests, eq(subtests.id, topics.subtestId))
    .where(like(subtests.slug, `${input.subtestKind}%`))
    .orderBy(asc(units.order), asc(lessons.order));

  if (rows.length === 0) {
    return err(apiError("not_found", `No learning path for subtest ${input.subtestKind}`));
  }

  return ok({ subtestKind: input.subtestKind, lessons: rows });
}

/**
 * A question with its options as shown inside a lesson.
 */
export interface LessonQuestionView {
  readonly id: string;
  readonly stem: string;
  readonly options: readonly LessonOptionView[];
}

/**
 * A selectable option within a lesson question.
 */
export interface LessonOptionView {
  readonly id: string;
  readonly label: string;
  readonly text: string;
}

/**
 * A lesson with its ordered questions and options.
 */
export interface LessonDetail {
  readonly id: string;
  readonly name: string;
  readonly questions: readonly LessonQuestionView[];
}

/**
 * Fetches the flat question-option join rows for a lesson.
 * @param ctx - The request context.
 * @param lessonId - The lesson id.
 * @returns The ordered join rows.
 */
async function fetchLessonQuestions(
  ctx: RequestContext,
  lessonId: string,
): Promise<LessonJoinRow[]> {
  return ctx.db
    .select({
      questionId: questions.id,
      stem: questions.stem,
      optionId: questionOptions.id,
      label: questionOptions.label,
      text: questionOptions.text,
    })
    .from(lessonQuestions)
    .innerJoin(questions, eq(questions.id, lessonQuestions.questionId))
    .innerJoin(questionOptions, eq(questionOptions.questionId, questions.id))
    .where(eq(lessonQuestions.lessonId, lessonId))
    .orderBy(asc(lessonQuestions.order), asc(questionOptions.order));
}

/**
 * Returns a lesson with its questions and options, or not_found.
 * @param input - The lesson id to load.
 * @param ctx - The request context.
 * @returns Ok with the lesson detail, or Err(not_found).
 */
export async function getLesson(
  input: GetLessonInput,
  ctx: RequestContext,
): Promise<Result<LessonDetail, ApiError>> {
  const [lesson] = await ctx.db.select().from(lessons).where(eq(lessons.id, input.lessonId));

  if (!lesson) {
    return err(apiError("not_found", "Lesson not found"));
  }

  const rows = await fetchLessonQuestions(ctx, input.lessonId);

  return ok({ id: lesson.id, name: lesson.name, questions: groupQuestions(rows) });
}

/**
 * A flat lesson-question-option join row.
 */
interface LessonJoinRow {
  readonly questionId: string;
  readonly stem: string;
  readonly optionId: string;
  readonly label: string;
  readonly text: string;
}

/**
 * Groups flat join rows into questions each carrying their options.
 * @param rows - The flat join rows ordered by question then option.
 * @returns The grouped question views.
 */
function groupQuestions(rows: readonly LessonJoinRow[]): LessonQuestionView[] {
  const byId = new Map<string, LessonQuestionView>();

  for (const row of rows) {
    const option = { id: row.optionId, label: row.label, text: row.text };
    const current = byId.get(row.questionId);

    if (current) {
      byId.set(row.questionId, { ...current, options: [...current.options, option] });
    } else {
      byId.set(row.questionId, { id: row.questionId, stem: row.stem, options: [option] });
    }
  }

  return [...byId.values()];
}
