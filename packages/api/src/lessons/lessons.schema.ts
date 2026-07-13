import { z } from "zod";

/**
 * A single answer to a lesson question.
 */
export const lessonAnswerSchema = z.object({
  questionId: z.uuid(),
  optionId: z.uuid(),
});

/**
 * Input schema for submitting a completed lesson.
 */
export const submitLessonInputSchema = z.object({
  lessonId: z.uuid(),
  answers: z.array(lessonAnswerSchema).min(1),
  idempotencyKey: z.string().min(1),
});

export type SubmitLessonInput = z.infer<typeof submitLessonInputSchema>;
