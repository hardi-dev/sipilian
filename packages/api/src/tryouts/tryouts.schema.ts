import { z } from "zod";

/**
 * Input schema for starting a tryout attempt.
 */
export const startTryoutInputSchema = z.object({
  packageId: z.uuid(),
});

export type StartTryoutInput = z.infer<typeof startTryoutInputSchema>;

/**
 * A single answer inside a tryout submission.
 * Objective subtests (TWK/TIU) supply `optionId`; TKP supplies `weight`.
 */
export const tryoutAnswerSchema = z
  .object({
    questionId: z.uuid(),
    optionId: z.uuid().optional(),
    weight: z.number().int().min(1).max(5).optional(),
  })
  .refine((data) => (data.optionId !== undefined) !== (data.weight !== undefined), {
    message: "Exactly one of optionId or weight must be provided",
  });

export type TryoutAnswer = z.infer<typeof tryoutAnswerSchema>;

/**
 * Input schema for submitting a completed tryout attempt.
 */
export const submitTryoutInputSchema = z.object({
  attemptId: z.uuid(),
  answers: z.array(tryoutAnswerSchema).min(1),
  idempotencyKey: z.string().min(1),
});

export type SubmitTryoutInput = z.infer<typeof submitTryoutInputSchema>;
