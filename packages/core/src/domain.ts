/**
 * The three SKD subtests: TWK (kebangsaan), TIU (intelegensia), TKP (karakteristik pribadi).
 */
export type SubtestKind = "twk" | "tiu" | "tkp";

/**
 * Ordered list of all SKD subtest kinds.
 */
export const SUBTEST_KINDS: readonly SubtestKind[] = ["twk", "tiu", "tkp"];
