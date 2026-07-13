import { z } from "zod";

/**
 * A single question progress entry with recall quality for SM-2 scheduling.
 */
export const questionProgressSchema = z.object({
  questionId: z.uuid(),
  quality: z.number().int().min(0).max(5),
});

export type QuestionProgress = z.infer<typeof questionProgressSchema>;

/**
 * Input schema for syncing question review progress.
 */
export const syncProgressInputSchema = z.object({
  items: z.array(questionProgressSchema).min(1),
});

export type SyncProgressInput = z.infer<typeof syncProgressInputSchema>;
