import { describe, expect, it } from "vitest";

import {
  dailyActivity,
  lessonCompletions,
  lessonCompletionsRelations,
  userQuestionStates,
  userQuestionStatesRelations,
  userStats,
} from "./progress";

const drizzleName = Symbol.for("drizzle:Name");

function tableName(table: unknown): string {
  return (table as Record<symbol, string>)[drizzleName] ?? "";
}

describe("progress schema", () => {
  it("defines lesson_completions table", () => {
    expect(tableName(lessonCompletions)).toBe("lesson_completions");
  });

  it("defines user_question_states table", () => {
    expect(tableName(userQuestionStates)).toBe("user_question_states");
  });

  it("defines user_stats table", () => {
    expect(tableName(userStats)).toBe("user_stats");
  });

  it("defines daily_activity table", () => {
    expect(tableName(dailyActivity)).toBe("daily_activity");
  });

  it("defines relation helpers", () => {
    expect(lessonCompletionsRelations).toBeDefined();
    expect(userQuestionStatesRelations).toBeDefined();
  });
});
