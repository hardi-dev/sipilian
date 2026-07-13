import { describe, expect, it } from "vitest";

import {
  tryoutAnswers,
  tryoutAnswersRelations,
  tryoutAttempts,
  tryoutAttemptsRelations,
  tryoutPackageQuestions,
  tryoutPackageQuestionsRelations,
  tryoutPackages,
  tryoutPackagesRelations,
} from "./tryout";

const drizzleName = Symbol.for("drizzle:Name");

function tableName(table: unknown): string {
  return (table as Record<symbol, string>)[drizzleName] ?? "";
}

describe("tryout schema", () => {
  it("defines tryout_packages table", () => {
    expect(tableName(tryoutPackages)).toBe("tryout_packages");
  });

  it("defines tryout_package_questions join table", () => {
    expect(tableName(tryoutPackageQuestions)).toBe("tryout_package_questions");
  });

  it("defines tryout_attempts table", () => {
    expect(tableName(tryoutAttempts)).toBe("tryout_attempts");
  });

  it("defines tryout_answers table", () => {
    expect(tableName(tryoutAnswers)).toBe("tryout_answers");
  });

  it("defines relation helpers", () => {
    expect(tryoutPackagesRelations).toBeDefined();
    expect(tryoutPackageQuestionsRelations).toBeDefined();
    expect(tryoutAttemptsRelations).toBeDefined();
    expect(tryoutAnswersRelations).toBeDefined();
  });

  it("allows null scores on an in-progress attempt", () => {
    expect(tryoutAttempts.twkScore.notNull).toBe(false);
    expect(tryoutAttempts.passedAll.notNull).toBe(false);
  });
});
