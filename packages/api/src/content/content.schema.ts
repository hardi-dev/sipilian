import { z } from "zod";

/**
 * Input schema for fetching a subtest learning path.
 */
export const getLearningPathInputSchema = z.object({
  subtestKind: z.enum(["twk", "tiu", "tkp"]),
});

export type GetLearningPathInput = z.infer<typeof getLearningPathInputSchema>;

/**
 * Input schema for fetching a single lesson with its questions.
 */
export const getLessonInputSchema = z.object({
  lessonId: z.uuid(),
});

export type GetLessonInput = z.infer<typeof getLessonInputSchema>;
