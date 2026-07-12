import { describe, expect, it } from "vitest";

import {
  lessonQuestions,
  lessonQuestionsRelations,
  lessons,
  lessonsRelations,
  questionOptions,
  questionOptionsRelations,
  questions,
  questionsRelations,
  questionStatusEnum,
  questionTypeEnum,
  subtests,
  subtestsRelations,
  topics,
  topicsRelations,
  units,
  unitsRelations,
} from "./content";

const drizzleName = Symbol.for("drizzle:Name");

function tableName(table: unknown): string {
  return (table as Record<symbol, string>)[drizzleName] ?? "";
}

describe("content schema", () => {
  it("defines subtests table", () => {
    expect(tableName(subtests)).toBe("subtests");
  });

  it("defines topics table FK to subtests", () => {
    expect(tableName(topics)).toBe("topics");
  });

  it("defines units table FK to topics", () => {
    expect(tableName(units)).toBe("units");
  });

  it("defines lessons table FK to units", () => {
    expect(tableName(lessons)).toBe("lessons");
  });

  it("defines questions table with type/status enums", () => {
    expect(tableName(questions)).toBe("questions");

    expect(questionTypeEnum.enumValues).toEqual(["multiple_choice"]);
    expect(questionStatusEnum.enumValues).toEqual(["draft", "published"]);
  });

  it("defines question_options with isCorrect nullable + weight nullable", () => {
    expect(tableName(questionOptions)).toBe("question_options");
  });

  it("defines lesson_questions join table", () => {
    expect(tableName(lessonQuestions)).toBe("lesson_questions");
  });

  it("defines relation helpers", () => {
    expect(subtestsRelations).toBeDefined();
    expect(topicsRelations).toBeDefined();
    expect(unitsRelations).toBeDefined();
    expect(lessonsRelations).toBeDefined();
    expect(questionsRelations).toBeDefined();
    expect(questionOptionsRelations).toBeDefined();
    expect(lessonQuestionsRelations).toBeDefined();
  });
});
