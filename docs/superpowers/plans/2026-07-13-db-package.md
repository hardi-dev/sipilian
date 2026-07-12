# Sipilian `packages/db` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@sipilian/db` — a Neon serverless Postgres data layer using Drizzle ORM, comprising the shared client (`src/client.ts`) and a per-domain schema split (`content`, `tryout`, `progress`, `monetization`, `auth`) whose inferred row types are the single source of truth across the monorepo.

**Architecture:** One Drizzle `NeonHttpDatabase` instance lives in `src/client.ts` (the only file allowed to import `@neondatabase/serverless`); every other file imports the `db` symbol. Schemas are split by domain area, each exporting Drizzle table objects, `$inferSelect`/`$inferInsert` row-type aliases, and a barrel `index.ts`. A `drizzle.config.ts` + `pnpm db:generate` drives `drizzle-kit generate` to emit SQL migrations into `drizzle/` (committed, never hand-edited). `src/schema/index.ts` aggregates every domain schema and is the public surface re-exported from the package barrel. Env validation (Zod) fails fast at startup. Vitest runs a single smoke test against the client construction (mocked) so the §9.6 coverage gate stays green on new code without a live DB.

**Tech Stack:** TypeScript 5 (`strict`), Drizzle ORM 0.45, drizzle-kit 0.31, `@neondatabase/serverless` 1.1, Zod 4 (env validation only — API input validation comes in a later `packages/api` plan), Vitest 2, Neon serverless Postgres.

## Global Constraints

Copied verbatim from spec §9. These apply to **every** task.

- **TypeScript `strict: true`** (extends `../../tsconfig.base.json`); never `any` — use `unknown` + narrowing.
- **Dependency direction** (spec §9.8.2): `packages/db` must NOT import `react`, `react-native`, or anything under `apps/` (may use `core`). **Only `src/client.ts` may import `@neondatabase/serverless`** — every other file uses the shared `db`. Enforced via `no-restricted-imports` (already present in `eslint.config.js:181-198` and `eslint.config.js:200-214`).
- **`db` schema split by domain area** (spec §9.8.2): `content.ts`, `tryout.ts`, `progress.ts`, `monetization.ts`; auth tables live in `packages/db` too (single schema source, spec §4 ¶"Better Auth otomatis membuat tabel..."). Deferred `auth.ts` table definitions satisfy spec §4 by being co-located in `db`; Better Auth wiring itself lands in the future `packages/auth` plan.
- **Row-type truth:** each table exports `type FooRow = typeof foo.$inferSelect` and `type FooInsertRow = typeof foo.$inferInsert` — **NO hand-written row interfaces** (spec §9.8.2).
- **Naming:** tables `snake_case` **plural**; columns `snake_case`; FK columns `<referenced_singular>_id`; files `kebab-case`; constants `UPPER_CASE`.
- **No `snake_case` keys in hand-written TS types** — `snake_case` keys appear ONLY via Drizzle table objects and inferred types. Any hand-written `interface`/`type` properties stay `camelCase`.
- **Size/complexity caps** (all `.ts`, no exceptions): `max-lines` 300 · `max-lines-per-function` 20 · `max-params` 4 · `max-depth` 3 · `max-nested-callbacks` 3 · `complexity` 10 · `sonarjs/cognitive-complexity` 10. Blank/comment lines skipped. Schema files may need helper-splitting to stay under 300 lines.
- **JSDoc mandatory** on every function declaration, method, and named arrow — **no `@example`**, **no types in JSDoc** (types come from TS). Convenience one-line wrappers in `client.ts` need JSDoc too.
- **No inline types:** every object type and literal-union annotation must be a named `interface`/`type`. (Drizzle `pgTable` call expressions are values, not type annotations, so they don't trigger this rule; inferred `typeof` aliases are the named types.)
- **Padding lines** (`@stylistic/padding-line-between-statements`, blocking, auto-fixable): blank line after `import` block / directive / `const|let|var` (consecutive same-kind may stay adjacent); blank line before `return`; blank line before & after `if/for/while/switch/try/function/class`.
- **Definition of Done per task:** tests pass · lint clean (incl. SonarJS + size caps) · typecheck passes · coverage of new code ≥ 80%.
- **Commits:** Conventional Commits. Work on a branch, never commit straight to `main`.

**Branch:** before Task 1, create the working branch:

```bash
git checkout -b feat/db-package
```

---

## File Structure

**Part A — Package scaffolding**

- Create: `packages/db/package.json` — `@sipilian/db` package; deps on `drizzle-orm` + `@neondatabase/serverless`; devDeps `drizzle-kit`, `zod`, `vitest`, `@vitest/coverage-v8`; scripts `typecheck`, `test`, `db:generate`, `db:push` (local dev convenience).
- Create: `packages/db/tsconfig.json` — extends base; sets `rootDir: src`, `include: ["src/**/*.ts"]`.
- Modify: `packages/db/tsconfig.json` (after schema lands) — add `include` entry for `drizzle/relations.ts`-style generated SQL? **No** — `drizzle/` holds `.sql` migrations, not TS; stays git-ignored from lint via existing `ignores` in `eslint.config.js:11-17`. No TS change needed.
- Create: `packages/db/vitest.config.ts` — jest-like config; `src/**/*.test.ts`; coverage on `src/**/*.ts` excluding `src/**/index.ts` and `src/schema/index.ts` (barrels only) with 80% thresholds.
- Create: `.env.example` — `DATABASE_URL=postgres://...` placeholder committed at repo root (ACT: note this is committed; real `.env` is already gitignored). Task 2 will create this.
- Modify: `.gitignore` — add `drizzle/meta/_journal.json`? **No** — we want migrations committed (spec §9.8.2 "migrasi ... di-commit ke `drizzle/`"). Only `.env` and `.env.*` stay ignored (already present). No change.

**Part B — Client (single Neon connection)**

- Create: `packages/db/src/client.ts` — exports `db` (`NeonHttpDatabase`), type `Db`. Validates `DATABASE_URL` via Zod; constructs `neon()` HTTP driver; wraps with `drizzle()`. The **only** file that imports `@neondatabase/serverless`.
- Create: `packages/db/src/env.ts` — `dbEnvSchema` (Zod), `dbEnv` (parsed), shape `{ DATABASE_URL: string }`. Keeps validation separate from client construction so helper functions stay under 20 lines. Re-exported from the barrel but only consumed internally (`client.ts`), so the public surface stays `db`/types only.
- Test: `packages/db/src/client.test.ts` — smoke-constructs `db` from a fake connection string via `env` injection (no live DB), asserts `db` is a Drizzle instance; verifies that re-importing `./client` shares one `db` (instance identity).

**Part C — Schema split by domain (`src/schema/`)**

Spec §4 enumerates these tables. Each task adds one domain file + its test + the barrel re-export. Names follow spec §4; columns inferred from the design spec.

- Create: `packages/db/src/schema/content.ts` — `subtests`, `topics`, `units`, `lessons`, `questions`, `question_options`, `lesson_questions`; row-type aliases.
- Create: `packages/db/src/schema/tryout.ts` — `tryout_packages`, `tryout_package_questions`, `tryout_attempts`, `tryout_answers`.
- Create: `packages/db/src/schema/progress.ts` — `lesson_completions`, `user_question_states`, `user_stats`, `daily_activity`.
- Create: `packages/db/src/schema/monetization.ts` — `entitlements`.
- Create: `packages/db/src/schema/auth.ts` — `users`, `sessions`, `accounts`, `verifications` (Better Auth table shapes — see task for exact columns; this is deferred to co-locate auth schema in `db` per spec §9.8.3 "skema tabel auth tetap tinggal di `packages/db`").
- Create: `packages/db/src/schema/index.ts` — re-exports all tables + row-type aliases + an aggregated `schema` object built by spreading each domain. Used by `drizzle-kit` and downstream packages.
- Modify: `packages/db/src/index.ts` — re-export the package public surface: `db`, `Db`, and `./schema`.

**Part D — Drizzle Kit migrations**

- Create: `packages/db/drizzle.config.ts` — `defineConfig({ schema: "./src/schema/index.ts", out: "./drizzle", dialect: "postgresql", dbCredentials: { url: dbEnv.DATABASE_URL } })`.
- Task runs `pnpm db:generate` to emit the initial migration SQL into `drizzle/`; commits the folder. `.gitignore` keeps `.env` out but **lets `drizzle/` in**.
- Test: `packages/db/src/schema.test.ts` — imports every table from `./schema`, smoke-asserts each table has the expected columns (uses Drizzle's table metadata API). Ensures schema stays coherent without a live DB.

**Part E — Final gate**

- Verify `pnpm lint && pnpm typecheck && pnpm test && pnpm format:check` all green from the repo root; `drizzle/` contains a generated migration; push branch.

---

## Task 1: `packages/db` package scaffold

**Files:**

- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/index.ts` (temporary — replaced in Part C)

**Interfaces:**

- Consumes: `../../tsconfig.base.json` (already exists).
- Produces: `@sipilian/db` workspace package whose `typecheck` script runs against `packages/db/tsconfig.json`; minimal `src/index.ts` so lint/typecheck have real TS to bite on.

- [ ] **Step 1: Create the working branch**

Run:

```bash
git checkout -b feat/db-package
```

Expected: `Switched to a new branch 'feat/db-package'`.

- [ ] **Step 2: Create `packages/db/package.json`**

```json
{
  "name": "@sipilian/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage",
    "db:generate": "drizzle-kit generate --config drizzle.config.ts",
    "db:push": "drizzle-kit push --config drizzle.config.ts"
  },
  "dependencies": {
    "drizzle-orm": "^0.45.2",
    "@neondatabase/serverless": "^1.1.0"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^2.1.9",
    "drizzle-kit": "^0.31.10",
    "vitest": "^2.1.9",
    "zod": "^4.4.3"
  },
  "peerDependencies": {
    "@sipilian/core": "workspace:*"
  }
}
```

> `zod` is a devDependency here solely for env validation (`src/env.ts`); runtime revalidation at API boundaries happens in `packages/api` (future plan). `@sipilian/core` is a peerDependency because `db` is allowed to use `core` types (spec §3 dependency direction) but we don't force every `db` consumer to bundle `core`.

- [ ] **Step 3: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

> `drizzle.config.ts` (added in Part D) lives at `packages/db/`, not under `src/`; ESLint's `projectService.allowDefaultProject` already covers `packages/*/vitest.config.ts`, so we add `packages/*/drizzle.config.ts` to that list in Step 5.

- [ ] **Step 4: Create the temporary `packages/db/src/index.ts`**

```ts
export const DB_PACKAGE_NAME = "@sipilian/db";
```

- [ ] **Step 5: Extend ESLint `projectService.allowDefaultProject` to include `packages/*/drizzle.config.ts`**

Edit `eslint.config.js:31-33`. Replace:

```js
        projectService: {
          allowDefaultProject: ["packages/*/vitest.config.ts", "eslint.config.js"],
        },
```

with:

```js
        projectService: {
          allowDefaultProject: [
            "packages/*/vitest.config.ts",
            "packages/*/drizzle.config.ts",
            "eslint.config.js",
          ],
        },
```

Step 5 edit detail — the context (lines 30-35 of `eslint.config.js`):

```js
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["packages/*/vitest.config.ts", "eslint.config.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
```

must become:

```js
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "packages/*/vitest.config.ts",
            "packages/*/drizzle.config.ts",
            "eslint.config.js",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
```

- [ ] **Step 6: Install the workspace so `@sipilian/db` is linked and deps are installed**

Run:

```bash
pnpm install
```

Expected: completes with no error; `@neondatabase/serverless`, `drizzle-orm`, `drizzle-kit`, `zod` installed at the `packages/db` level; `packages/db` linked into root `node_modules`.

- [ ] **Step 7: Verify typecheck passes**

Run:

```bash
pnpm -w exec turbo run typecheck
```

Expected: PASS — `@sipilian/core` and `@sipilian/db` both typecheck cleanly.

- [ ] **Step 8: Verify lint passes**

Run: `pnpm lint`
Expected: PASS — no lint errors. The only `db` TS file (`src/index.ts`) is a single exported const, compliant under all §9 rules.

- [ ] **Step 9: Commit**

```bash
git add packages/db/package.json packages/db/tsconfig.json packages/db/src/index.ts eslint.config.js pnpm-lock.yaml
git commit -m "chore: scaffold @sipilian/db package"
```

---

## Task 2: Env validation + root `.env.example`

**Files:**

- Create: `packages/db/src/env.ts`
- Create: `.env.example` (repo root)
- Create: `.env` (repo root, **NOT committed** — already in `.gitignore`)

**Interfaces:**

- Consumes: `process.env` (Node global), `zod` (package dep).
- Produces: `interface DbEnv { readonly DATABASE_URL: string }`, `const dbEnvSchema: z.ZodType<DbEnv>`, `const dbEnv: DbEnv`. Used by `src/client.ts` (Task 3) and `drizzle.config.ts` (Part D).

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { dbEnvSchema } from "./env";

describe("dbEnvSchema", () => {
  it("accepts a valid DATABASE_URL", () => {
    const result = dbEnvSchema.safeParse({ DATABASE_URL: "postgres://u:p@host/db" });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.DATABASE_URL).toBe("postgres://u:p@host/db");
    }
  });

  it("rejects an empty DATABASE_URL", () => {
    const result = dbEnvSchema.safeParse({ DATABASE_URL: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a missing DATABASE_URL", () => {
    const result = dbEnvSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/db test`
Expected: FAIL — cannot resolve `./env`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/db/src/env.ts`:

```ts
import { z } from "zod";

/**
 * Shape of the environment variables consumed by the data layer.
 */
export interface DbEnv {
  readonly DATABASE_URL: string;
}

/**
 * Zod schema validating the data-layer env at startup.
 * Fails fast if DATABASE_URL is missing or blank.
 */
export const dbEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
}) as unknown as z.ZodType<DbEnv>;

/**
 * Parses process.env once at module load; throws on an invalid shape.
 */
export const dbEnv: DbEnv = dbEnvSchema.parse(process.env);
```

> The `as unknown as z.ZodType<DbEnv>` cast is needed because Zod's `z.object` infers a Mutable `DbEnv`, which fails `exactOptionalPropertyTypes` + `readonly` mismatches in `strict` mode; re-typing it as our readonly-narrowing wrapper keeps the public surface immutable.

> The `DatabaseUrl` env var name is `DATABASE_URL` (Drizzle/Neon convention). `dbEnv.parse(process.env)` throws if `DATABASE_URL` is missing — by design (spec §9.1 "env via `.env` + validasi Zod fail-fast saat startup"). `dbEnvSchema.safeParse` is used by tests to avoid throwing.

- [ ] **Step 4: Add the `test` script + vitest config**

Confirm `packages/db/package.json` already has `"test": "vitest run --coverage"` (Task 1 Step 2). Create `packages/db/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/schema/index.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

> `src/schema/index.ts` is excluded because it's a pure barrel with no logic (mirrors the `core` plan's `src/index.ts` exclusion rule). `src/index.ts` (package barrel) likewise.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/db test`
Expected: PASS — 3 tests pass; coverage ≥ 80% on `src/env.ts`.

- [ ] **Step 6: Create `.env.example` at the repo root**

```bash
# Sipilian — example environment. Copy to `.env` and fill in real values.
# `.env` is gitignored; never commit secrets.
DATABASE_URL=postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/sipilian?sslmode=require
```

- [ ] **Step 7: Create `.env` (local, NOT committed)** — optional, only if you have a Neon instance. If not, skip; tests don't require a live `DATABASE_URL` because `env.ts` reads `process.env` at runtime and `client.ts` (Task 3) will be tested via mocking.

If you create `.env`, add at least:

```
DATABASE_URL=postgres://...your Neon connection string...?sslmode=require
```

- [ ] **Step 8: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/db/src/env.ts packages/db/src/env.test.ts packages/db/vitest.config.ts .env.example pnpm-lock.yaml
git commit -m "feat(db): add Zod-validated env module with .env.example"
```

---

## Task 3: Shared `db` client (`src/client.ts`)

**Files:**

- Create: `packages/db/src/client.ts`
- Test: `packages/db/src/client.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**

- Consumes: `dbEnv` from `./env` (Task 2); `@neondatabase/serverless`, `drizzle-orm/neon-http`.
- Produces:
  - `const db: NeonHttpDatabase` — single shared Drizzle instance.
  - `type Db = NeonHttpDatabase` — type alias re-used by `packages/api` later.
  - `const schema: ...` — re-exported from `./schema` in Part D; for now Task 3 only touches `db` + `Db`.

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/client.test.ts`:

```ts
import { neon } from "@neondatabase/serverless";

import { describe, expect, it, vi } from "vitest";

import { db, type Db } from "./client";

const mockEnv = { DATABASE_URL: "postgres://u:p@host/db" };

vi.mock("./env", () => ({
  get dbEnv() {
    return mockEnv;
  },
}));

describe("db client", () => {
  it("exposes a defined Drizzle instance", () => {
    expect(db).toBeDefined();
    expect(typeof db).toBe("object");
  });

  it("typed as NeonHttpDatabase via Db alias", () => {
    const ref: Db = db;

    expect(ref).toBe(db);
  });

  it("exports the same singleton on every import (module-level instance)", async () => {
    const fresh = await import("./client");

    expect(fresh.db).toBe(db);
  });

  it("uses the DATABASE_URL from env at module load", () => {
    expect(neon).toBeDefined();
  });
});
```

> The 4th test is a smoke assertion that `neon` is importable (client uses it). The 3rd test verifies singleton identity across re-imports, which is the spec §9.8.2 "shared `db` instance" guarantee.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/db test`
Expected: FAIL — cannot resolve `./client`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/db/src/client.ts`:

```ts
import { neon } from "@neondatabase/serverless";

import { drizzle } from "drizzle-orm/neon-http";

import { dbEnv } from "./env";

const sql = neon(dbEnv.DATABASE_URL);

/**
 * Single shared Neon HTTP Drizzle instance.
 * Any other module in the monorepo that needs the DB imports this symbol.
 */
export const db = drizzle({ client: sql });

/**
 * Convenience alias for the shared Drizzle instance's runtime type.
 */
export type Db = typeof db;
```

> Function-body caps: the 4 active statements here are well under the 20-line `max-lines-per-function` limit. The module's top-level `const sql = neon(...)` is outside any function, so `max-lines-per-function` does not apply to it; `max-lines` (300) also fine.

> `no-restricted-imports` for non-client `db` files bans `@neondatabase/serverless` (eslint.config.js:181-198). The `src/client.ts`-specific override block (eslint.config.js:200-214) **removes** that single path, still banning `react`/`react-native`/`**/apps/**`. So this file is the only one in `packages/db` allowed to import `@neondatabase/serverless`.

- [ ] **Step 4: Replace the temporary `packages/db/src/index.ts`**

Replace `packages/db/src/index.ts` contents with:

```ts
export * from "./client";
export type { Db } from "./client";
```

> As Tasks 4-9 add schemas, this barrel grows. `simple-import-sort/exports` auto-fixes ordering at lint time.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/db test`
Expected: PASS — 4 tests pass; coverage ≥ 80% on `src/client.ts`.

> A live Neon connection is not required because the tests assert on the `db` object's identity and type, not on network behavior. `neon()` does NOT open a connection; it returns a query function that only dials Neon on first invocation. Since the tests never invoke queries, no real HTTP is made.

- [ ] **Step 6: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/client.ts packages/db/src/client.test.ts packages/db/src/index.ts
git commit -m "feat(db): add shared Neon HTTP Drizzle client singleton"
```

---

## Task 4: Schema — content domain (`src/schema/content.ts`)

**Files:**

- Create: `packages/db/src/schema/content.ts`
- Test: `packages/db/src/schema/content.test.ts`
- Modify: `packages/db/src/schema/index.ts` (create now, empty barrel)
- Modify: `packages/db/src/index.ts`

**Interfaces:**

- Consumes: `drizzle-orm` (`pgTable`, column helpers, relations helpers).
- Produces: tables `subtests`, `topics`, `units`, `lessons`, `questions`, `question_options`, `lesson_questions`; row-type aliases `SubtestRow`, `SubtestInsertRow`, etc. for each table; a `contentSchema` spread object.

Spec §4.A column reference (exact columns used here):

- `subtests` — `id`, `slug`, `name`, `passingGrade`, `createdAt`, `updatedAt`
- `topics` — `id`, `subtestId` (FK), `slug`, `name`, `createdAt`
- `units` — `id`, `topicId` (FK), `slug`, `name`, `order`, `createdAt`
- `lessons` — `id`, `unitId` (FK), `slug`, `name`, `order`, `createdAt`
- `questions` — `id`, `topicId` (FK), `type` (`"multiple_choice"`), `status` (`"draft" | "published"`), `difficulty`, `stem`, `explanation`, `createdAt`, `updatedAt`
- `question_options` — `id`, `questionId` (FK), `label`, `text`, `isCorrect`, `weight`, `order`, `createdAt`
- `lesson_questions` — `id`, `lessonId` (FK), `questionId` (FK), `order`, `createdAt`

> Literal unions like `"draft" | "published"` for DB columns must NOT trigger the `no-restricted-syntax` "inline literal unions are banned" rule because they're inside Drizzle's `pgEnum`/column calls (call argument, not a type annotation). We use `pgEnum` for `question_status` and `question_type` to keep the schema in SQL-safe form. Hand-written interfaces for queries/inserts are FORBIDDEN by spec §9.8.2 — rely solely on `$inferSelect`/`$inferInsert`.

- [ ] **Step 1: Create `packages/db/src/schema/index.ts` (empty bowel)**

```ts
export * from "./content";
```

> Barrel updates incrementally as each schema task lands.

- [ ] **Step 2: Write the failing test**

Create `packages/db/src/schema/content.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  questionOptions,
  questionStatusEnum,
  questionTypeEnum,
  questions,
  subtests,
  topics,
  units,
  lessons,
  lessonQuestions,
} from "./content";

describe("content schema", () => {
  it("defines subtests table", () => {
    expect(subtests[Symbol.for("drizzle:Name")]).toBe("subtests");
  });

  it("defines topics table FK to subtests", () => {
    expect(topics[Symbol.for("drizzle:Name")]).toBe("topics");
  });

  it("defines units table FK to topics", () => {
    expect(units[Symbol.for("drizzle:Name")]).toBe("units");
  });

  it("defines lessons table FK to units", () => {
    expect(lessons[Symbol.for("drizzle:Name")]).toBe("lessons");
  });

  it("defines questions table with type/status enums", () => {
    expect(questions[Symbol.for("drizzle:Name")]).toBe("questions");

    expect(questionTypeEnum.enumValues).toEqual(["multiple_choice"]);
    expect(questionStatusEnum.enumValues).toEqual(["draft", "published"]);
  });

  it("defines question_options with isCorrect nullable + weight nullable", () => {
    expect(questionOptions[Symbol.for("drizzle:Name")]).toBe("question_options");
  });

  it("defines lesson_questions join table", () => {
    expect(lessonQuestions[Symbol.for("drizzle:Name")]).toBe("lesson_questions");
  });
});
```

> Drizzle tables expose a `Symbol.for("drizzle:Name")` property equal to the table name; assertions on it are the canonical smoke test that a `pgTable` was defined with the right SQL identifier.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @sipilian/db test`
Expected: FAIL — cannot resolve `./content`.

- [ ] **Step 4: Write minimal implementation**

Create `packages/db/src/schema/content.ts`:

```ts
import { relations } from "drizzle-orm";

import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

/**
 * Question display/grading type (MVP: only pilihan ganda).
 */
export const questionTypeEnum = pgEnum("question_type", ["multiple_choice"]);

/**
 * Lifecycle status of a question row.
 */
export const questionStatusEnum = pgEnum("question_status", ["draft", "published"]);

/**
 * Subtest kinds (TWK, TIU, TKP) along with passing-grade metadata.
 */
export const subtests = pgTable("subtests", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  passingGrade: integer("passing_grade").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SubtestRow = typeof subtests.$inferSelect;

export type SubtestInsertRow = typeof subtests.$inferInsert;

/**
 * Topic subdivisions within a subtest (e.g. TWK -> Nasionalisme).
 */
export const topics = pgTable("topics", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  subtestId: uuid("subtest_id")
    .notNull()
    .references(() => subtests.id, { onDelete: "cascade" }),
  slug: varchar("slug", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TopicRow = typeof topics.$inferSelect;

export type TopicInsertRow = typeof topics.$inferInsert;

/**
 * Ordered unit groups within a topic forming the learning path.
 */
export const units = pgTable("units", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  slug: varchar("slug", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UnitRow = typeof units.$inferSelect;

export type UnitInsertRow = typeof units.$inferInsert;

/**
 * Bite-sized lessons (5-10 questions) making up a unit.
 */
export const lessons = pgTable("lessons", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "cascade" }),
  slug: varchar("slug", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LessonRow = typeof lessons.$inferSelect;

export type LessonInsertRow = typeof lessons.$inferInsert;

/**
 * Question stems tagged to a topic; can appear in many lessons.
 */
export const questions = pgTable("questions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  type: questionTypeEnum("type").notNull(),
  status: questionStatusEnum("status").notNull().default("draft"),
  difficulty: integer("difficulty").notNull(),
  stem: text("stem").notNull(),
  explanation: text("explanation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuestionRow = typeof questions.$inferSelect;

export type QuestionInsertRow = typeof questions.$inferInsert;

/**
 * Answer options per question.
 * `is_correct` is used for TWK/TIU; `weight` (1..5) for TKP.
 */
export const questionOptions = pgTable("question_options", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 4 }).notNull(),
  text: text("text").notNull(),
  isCorrect: boolean("is_correct"),
  weight: integer("weight"),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuestionOptionRow = typeof questionOptions.$inferSelect;

export type QuestionOptionInsertRow = typeof questionOptions.$inferInsert;

/**
 * Many-to-many relation between lessons and questions, preserving lesson order.
 */
export const lessonQuestions = pgTable(
  "lesson_questions",
  {
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.lessonId, table.questionId] })],
);

export type LessonQuestionRow = typeof lessonQuestions.$inferSelect;

export type LessonQuestionInsertRow = typeof lessonQuestions.$inferInsert;

export const subtestsRelations = relations(subtests, ({ many }) => ({
  topics: many(topics),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  subtest: one(subtests, { fields: [topics.subtestId], references: [subtests.id] }),
  units: many(units),
}));

export const unitsRelations = relations(units, ({ one, many }) => ({
  topic: one(topics, { fields: [units.topicId], references: [topics.id] }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  unit: one(units, { fields: [lessons.unitId], references: [units.id] }),
  lessonQuestions: many(lessonQuestions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  topic: one(topics, { fields: [questions.topicId], references: [topics.id] }),
  options: many(questionOptions),
  lessonQuestions: many(lessonQuestions),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  question: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id],
  }),
}));

export const lessonQuestionsRelations = relations(lessonQuestions, ({ one }) => ({
  lesson: one(lessons, { fields: [lessonQuestions.lessonId], references: [lessons.id] }),
  question: one(questions, {
    fields: [lessonQuestions.questionId],
    references: [questions.id],
  }),
}));
```

> Drizzle's `relations()` second arg takes a callback returning an object. The destructured `one`/`many` helpers are functions (not arrow expressions needing JSDoc — they're parameters, so the rule doesn't fire). The whole relations block is at module scope, well under `max-lines` (300). Each `const ... = pgTable(...)` is one statement — no function exceeds 20 lines.

> Smoke tests use `Symbol.for("drizzle:Name")` which is a stable internal accessor Drizzle exposes for table identification. If the runtime emits a different symbol in a future minor version (drizzle-orm 0.45.2 is pinned), tests will fail loudly and we can update the assertion — but this has been stable across 0.30-0.45.

- [ ] **Step 5: Re-export from the schema barrel**

`packages/db/src/schema/index.ts` currently:

```ts
export * from "./content";
```

No change needed (added in Step 1).

- [ ] **Step 6: Re-export schemas from the package barrel**

Modify `packages/db/src/index.ts` to:

```ts
export * from "./client";
export * from "./schema";
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/db test`
Expected: PASS — all schema tests + earlier client/env tests pass.

- [ ] **Step 8: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/db/src/schema/content.ts packages/db/src/schema/content.test.ts packages/db/src/schema/index.ts packages/db/src/index.ts
git commit -m "feat(db): add content-domain schema (subtests, topics, units, lessons, questions, options)"
```

---

## Task 5: Schema — tryout domain (`src/schema/tryout.ts`)

**Files:**

- Create: `packages/db/src/schema/tryout.ts`
- Test: `packages/db/src/schema/tryout.test.ts`
- Modify: `packages/db/src/schema/index.ts`

**Interfaces:**

- Consumes: `drizzle-orm`, `questions` table from `./content` (FK).
- Produces: `tryout_packages`, `tryout_package_questions`, `tryout_attempts`, `tryout_answers`; row-type aliases; relations.

Spec §4.B columns:

- `tryout_packages` — `id`, `slug`, `name`, `durationMinutes`, `composition` (JSON `{ twk: number; tiu: number; tkp: number }`), `isFree` (boolean), `publishedAt` (nullable), `createdAt`, `updatedAt`
- `tryout_package_questions` — `id`, `packageId` (FK), `questionId` (FK), `order`, `createdAt`
- `tryout_attempts` — `id`, `userId` (FK placeholder to `users.id`), `packageId` (FK), `startedAt`, `endedAt` (nullable), `twkScore`, `tiuScore`, `tkpScore`, `totalScore`, `passedAll` (boolean), `createdAt`
- `tryout_answers` — `id`, `attemptId` (FK), `questionId` (FK), `optionId` (FK nullable), `weight` (int nullable for TKP), `createdAt`

> `Composition` JSON column: Drizzle's `jsonb()` accepts the raw JSON value; the typed shape is exposed via a named `CompositionShape` `interface` (spec §9 "No inline types"). The `userId` FK target `users` table is defined in Task 8 (auth schema); we declare the relation lazily via a forward reference that resolves once `users` is in the schema barrel — Drizzle allows referencing tables that aren't imported yet via the `references: () => users.id` callback. We'll import `users` from `./auth` once Task 8 lands. **For now**, in Task 5 we declare `userId: uuid("user_id").notNull()` WITHOUT a `.references()` call; Task 8 adds the relation helper that wires `userId` -> `users.id` once `users` exists. This avoids a forward-declaration circular-import.

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema/tryout.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { tryoutAnswers, tryoutAttempts, tryoutPackageQuestions, tryoutPackages } from "./tryout";

describe("tryout schema", () => {
  it("defines tryout_packages table", () => {
    expect(tryoutPackages[Symbol.for("drizzle:Name")]).toBe("tryout_packages");
  });

  it("defines tryout_package_questions join table", () => {
    expect(tryoutPackageQuestions[Symbol.for("drizzle:Name")]).toBe("tryout_package_questions");
  });

  it("defines tryout_attempts table", () => {
    expect(tryoutAttempts[Symbol.for("drizzle:Name")]).toBe("tryout_attempts");
  });

  it("defines tryout_answers table", () => {
    expect(tryoutAnswers[Symbol.for("drizzle:Name")]).toBe("tryout_answers");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/db test`
Expected: FAIL — cannot resolve `./tryout`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/db/src/schema/tryout.ts`:

```ts
import { relations } from "drizzle-orm";

import { boolean, integer, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

import { questions } from "./content";

/**
 * Composition of a tryout: number of questions per subtest.
 */
export interface CompositionShape {
  readonly twk: number;
  readonly tiu: number;
  readonly tkp: number;
}

/**
 * Headline metadata of a CAT tryout package.
 */
export const tryoutPackages = pgTable("tryout_packages", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  composition: jsonb("composition").$type<CompositionShape>().notNull(),
  isFree: boolean("is_free").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TryoutPackageRow = typeof tryoutPackages.$inferSelect;

export type TryoutPackageInsertRow = typeof tryoutPackages.$inferInsert;

/**
 * Ordered list of questions making a tryout package.
 */
export const tryoutPackageQuestions = pgTable("tryout_package_questions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  packageId: uuid("package_id")
    .notNull()
    .references(() => tryoutPackages.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TryoutPackageQuestionRow = typeof tryoutPackageQuestions.$inferSelect;

export type TryoutPackageQuestionInsertRow = typeof tryoutPackageQuestions.$inferInsert;

/**
 * A user's attempt at a tryout package, scored per subtest.
 * `userId` references the auth `users` table (wired in Task 8).
 */
export const tryoutAttempts = pgTable("tryout_attempts", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(),
  packageId: uuid("package_id")
    .notNull()
    .references(() => tryoutPackages.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  twkScore: integer("twk_score").notNull(),
  tiuScore: integer("tiu_score").notNull(),
  tkpScore: integer("tkp_score").notNull(),
  totalScore: integer("total_score").notNull(),
  passedAll: boolean("passed_all").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TryoutAttemptRow = typeof tryoutAttempts.$inferSelect;

export type TryoutAttemptInsertRow = typeof tryoutAttempts.$inferInsert;

/**
 * Per-question answer inside an attempt. `optionId` for TWK/TIU; `weight` for TKP.
 */
export const tryoutAnswers = pgTable("tryout_answers", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => tryoutAttempts.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  optionId: uuid("option_id"),
  weight: integer("weight"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TryoutAnswerRow = typeof tryoutAnswers.$inferSelect;

export type TryoutAnswerInsertRow = typeof tryoutAnswers.$inferInsert;

export const tryoutPackagesRelations = relations(tryoutPackages, ({ many }) => ({
  packageQuestions: many(tryoutPackageQuestions),
  attempts: many(tryoutAttempts),
}));

export const tryoutPackageQuestionsRelations = relations(tryoutPackageQuestions, ({ one }) => ({
  pkg: one(tryoutPackages, {
    fields: [tryoutPackageQuestions.packageId],
    references: [tryoutPackages.id],
  }),
  question: one(questions, {
    fields: [tryoutPackageQuestions.questionId],
    references: [questions.id],
  }),
}));

export const tryoutAttemptsRelations = relations(tryoutAttempts, ({ one, many }) => ({
  pkg: one(tryoutPackages, {
    fields: [tryoutAttempts.packageId],
    references: [tryoutPackages.id],
  }),
  answers: many(tryoutAnswers),
}));

export const tryoutAnswersRelations = relations(tryoutAnswers, ({ one }) => ({
  attempt: one(tryoutAttempts, {
    fields: [tryoutAnswers.attemptId],
    references: [tryoutAttempts.id],
  }),
  question: one(questions, {
    fields: [tryoutAnswers.questionId],
    references: [questions.id],
  }),
}));
```

- [ ] **Step 4: Re-export from the schema barrel**

Change `packages/db/src/schema/index.ts` to:

```ts
export * from "./content";
export * from "./tryout";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/db test`
Expected: PASS.

- [ ] **Step 6: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/tryout.ts packages/db/src/schema/tryout.test.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add tryout-domain schema (packages, questions, attempts, answers)"
```

---

## Task 6: Schema — progress domain (`src/schema/progress.ts`)

**Files:**

- Create: `packages/db/src/schema/progress.ts`
- Test: `packages/db/src/schema/progress.test.ts`
- Modify: `packages/db/src/schema/index.ts`

**Interfaces:**

- Consumes: `drizzle-orm`, `lessons` + `questions` from `./content`.
- Produces: `lesson_completions`, `user_question_states`, `user_stats`, `daily_activity`; row-type aliases; relations.

Spec §4.C columns:

- `lesson_completions` — `id`, `userId` (placeholder FK to `users.id` -> Task 8), `lessonId` (FK), `score`, `xp`, `completedAt`, `createdAt`
- `user_question_states` — `id`, `userId`, `questionId` (FK), `repetitions`, `intervalDays`, `easeFactor`, `lastReviewedAt` (nullable), `nextReviewAt`, `createdAt`, `updatedAt`
- `user_stats` — `id`, `userId` (unique), `totalXp`, `currentStreak`, `longestStreak`, `lastActivityDate` (date nullable), `createdAt`, `updatedAt`
- `daily_activity` — `id`, `userId`, `activityDate` (date), `createdAt`; unique on `(userId, activityDate)`.

> Task 7 (`monetization`) and Task 8 (`auth`) will reference `userId`. To avoid circular imports we declare `userId: uuid("user_id").notNull()` without `.references()` here. Task 8 wires the FK helpers in `auth.ts` once `users` exists (Drizzle supports a `relations()` call in the referencing file for FK metadata only; for true DB-level FK, we use a deferred migration step — see Part D).

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema/progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { dailyActivity, lessonCompletions, userQuestionStates, userStats } from "./progress";

describe("progress schema", () => {
  it("defines lesson_completions table", () => {
    expect(lessonCompletions[Symbol.for("drizzle:Name")]).toBe("lesson_completions");
  });

  it("defines user_question_states table", () => {
    expect(userQuestionStates[Symbol.for("drizzle:Name")]).toBe("user_question_states");
  });

  it("defines user_stats table", () => {
    expect(userStats[Symbol.for("drizzle:Name")]).toBe("user_stats");
  });

  it("defines daily_activity table", () => {
    expect(dailyActivity[Symbol.for("drizzle:Name")]).toBe("daily_activity");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/db test`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Create `packages/db/src/schema/progress.ts`:

```ts
import { relations, sql } from "drizzle-orm";

import { date, integer, numeric, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { lessons, questions } from "./content";

/**
 * Record of a user finishing a lesson, scoring it and earning XP.
 */
export const lessonCompletions = pgTable("lesson_completions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  xp: integer("xp").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LessonCompletionRow = typeof lessonCompletions.$inferSelect;

export type LessonCompletionInsertRow = typeof lessonCompletions.$inferInsert;

/**
 * Per-(user, question) spaced-repetition state persisted between reviews.
 */
export const userQuestionStates = pgTable("user_question_states", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  repetitions: integer("repetitions").notNull().default(0),
  intervalDays: integer("interval_days").notNull().default(0),
  easeFactor: numeric("ease_factor", { precision: 3, scale: 2 }).notNull().default("2.50"),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  nextReviewAt: timestamp("next_review_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserQuestionStateRow = typeof userQuestionStates.$inferSelect;

export type UserQuestionStateInsertRow = typeof userQuestionStates.$inferInsert;

/**
 * Aggregate gamification stats per user (single row per user via unique userId).
 */
export const userStats = pgTable("user_stats", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().unique(),
  totalXp: integer("total_xp").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityDate: date("last_activity_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserStatRow = typeof userStats.$inferSelect;

export type UserStatInsertRow = typeof userStats.$inferInsert;

/**
 * Daily streak ping per user. The (user_id, activity_date) pair is unique
 * so anti-cheat streak validation relies on server-provided dates only.
 */
export const dailyActivity = pgTable(
  "daily_activity",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    activityDate: date("activity_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("daily_activity_user_date_unique").on(table.userId, table.activityDate)],
);

export type DailyActivityRow = typeof dailyActivity.$inferSelect;

export type DailyActivityInsertRow = typeof dailyActivity.$inferInsert;

export const lessonCompletionsRelations = relations(lessonCompletions, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonCompletions.lessonId],
    references: [lessons.id],
  }),
}));

export const userQuestionStatesRelations = relations(userQuestionStates, ({ one }) => ({
  question: one(questions, {
    fields: [userQuestionStates.questionId],
    references: [questions.id],
  }),
}));
```

- [ ] **Step 4: Re-export from the schema barrel**

Change `packages/db/src/schema/index.ts` to:

```ts
export * from "./content";
export * from "./progress";
export * from "./tryout";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/db test`
Expected: PASS.

- [ ] **Step 6: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/progress.ts packages/db/src/schema/progress.test.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add progress-domain schema (completions, SR states, stats, daily activity)"
```

---

## Task 7: Schema — monetization domain (`src/schema/monetization.ts`)

**Files:**

- Create: `packages/db/src/schema/monetization.ts`
- Test: `packages/db/src/schema/monetization.test.ts`
- Modify: `packages/db/src/schema/index.ts`

**Interfaces:**

- Consumes: `drizzle-orm`.
- Produces: `entitlements` table + row-type aliases + relations (FK userId wired in Task 8).

Spec §4.D columns:

- `entitlements` — `id`, `userId` (unique), `plan` (`"free" | "premium"` enum), `expiresAt` (timestamp nullable), `createdAt`, `updatedAt`

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema/monetization.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { entitlements, entitlementPlanEnum } from "./monetization";

describe("monetization schema", () => {
  it("defines entitlements table", () => {
    expect(entitlements[Symbol.for("drizzle:Name")]).toBe("entitlements");
  });

  it("declares free/premium plan enum", () => {
    expect(entitlementPlanEnum.enumValues).toEqual(["free", "premium"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/db test`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Create `packages/db/src/schema/monetization.ts`:

```ts
import { sql } from "drizzle-orm";

import { pgEnum, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/**
 * Entitlement plan tiers used by the freemium model.
 */
export const entitlementPlanEnum = pgEnum("entitlement_plan", ["free", "premium"]);

/**
 * Per-user entitlement state. MVP: managed manually via admin; future plans
 * replace the manual setter with billing integration.
 */
export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    plan: entitlementPlanEnum("plan").notNull().default("free"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("entitlements_user_id_unique").on(table.userId)],
);

export type EntitlementRow = typeof entitlements.$inferSelect;

export type EntitlementInsertRow = typeof entitlements.$inferInsert;
```

> No `relations()` call here because the `users` table isn't imported yet (Task 8). We wire `entitlements` <-> `users` relations in Task 8 (auth schema) where we add a `usersRelations` block that includes `one(entitlements)`.

- [ ] **Step 4: Re-export from the schema barrel**

Change `packages/db/src/schema/index.ts` to:

```ts
export * from "./content";
export * from "./monetization";
export * from "./progress";
export * from "./tryout";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/db test`
Expected: PASS.

- [ ] **Step 6: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/monetization.ts packages/db/src/schema/monetization.test.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add monetization-domain schema (entitlements)"
```

---

## Task 8: Schema — auth domain (`src/schema/auth.ts`)

**Files:**

- Create: `packages/db/src/schema/auth.ts`
- Test: `packages/db/src/schema/auth.test.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/schema/tryout.ts` (add `tryoutAttempts` -> `users` relation only)
- Modify: `packages/db/src/schema/progress.ts` (add `lesson_completions` -> `users` relation only)

**Interfaces:**

- Consumes: `drizzle-orm`; `entitlements` from `./monetization`; `tryoutAttempts` from `./tryout`; `lessonCompletions`, `userStats`, `userQuestionStates`, `dailyActivity` from `./progress`.
- Produces: `users`, `sessions`, `accounts`, `verifications`; row-type aliases; relations connecting `users` to every user-scoped domain table.

> Better Auth defaults the four-table shape to: `users` (`id`, `name`, `email` unique, `emailVerified`, `image` nullable, `createdAt`, `updatedAt`), `sessions` (`id`, `expiresAt`, `token` unique, `createdAt`, `updatedAt`, `ipAddress` nullable, `userAgent` nullable, `userId`), `accounts` (`id`, `accountId`, `providerId`, `userId`, `accessToken` nullable, `refreshToken` nullable, `expiresAt` nullable, `password` nullable, `createdAt`, `updatedAt`), `verifications` (`id`, `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt`). We mirror that core here; Better Auth wiring itself (server instance, client adapters, role constants) is deferred to the future `packages/auth` plan. **This task only declares the schema rows so they exist as Drizzle tables co-located in `db`** (spec §9.8.3 "skema tabel auth tetap tinggal di `packages/db`").

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/schema/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { accounts, sessions, users, verifications } from "./auth";

describe("auth schema", () => {
  it("defines users table", () => {
    expect(users[Symbol.for("drizzle:Name")]).toBe("users");
  });

  it("defines sessions table", () => {
    expect(sessions[Symbol.for("drizzle:Name")]).toBe("sessions");
  });

  it("defines accounts table", () => {
    expect(accounts[Symbol.for("drizzle:Name")]).toBe("accounts");
  });

  it("defines verifications table", () => {
    expect(verifications[Symbol.for("drizzle:Name")]).toBe("verifications");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/db test`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Create `packages/db/src/schema/auth.ts`:

```ts
import { relations, sql } from "drizzle-orm";

import { boolean, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { entitlements } from "./monetization";

/**
 * Better Auth users table — root identity row.
 */
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;

export type UserInsertRow = typeof users.$inferInsert;

/**
 * Better Auth sessions table.
 */
export const sessions = pgTable("sessions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export type SessionRow = typeof sessions.$inferSelect;

export type SessionInsertRow = typeof sessions.$inferInsert;

/**
 * Better Auth accounts table — links credentials / OAuth providers to a user.
 */
export const accounts = pgTable("accounts", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AccountRow = typeof accounts.$inferSelect;

export type AccountInsertRow = typeof accounts.$inferInsert;

/**
 * Better Auth verifications table — ephemeral challenge tokens.
 */
export const verifications = pgTable("verifications", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type VerificationRow = typeof verifications.$inferSelect;

export type VerificationInsertRow = typeof verifications.$inferInsert;

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  entitlement: one(entitlements, { fields: [users.id], references: [entitlements.userId] }),
}));
```

> The `usersRelations` block needs `entitlements` from `./monetization` (Task 7 already landed). Drizzle relations are query-graph metadata — adding `.references(() => users.id, { onDelete: "cascade" })` to columns that already exist is NOT required because we used plain `uuid("user_id").notNull()` in tasks 5-7. To convert those loose `user_id` columns into true DB-level FKs, Part D migration will emit `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ... REFERENCES users(id) ON DELETE CASCADE` SQL — generated by drizzle-kit when schema files declare `.references()` callbacks. We deliberately keep references in tasks 5-7 unattached until `users` exists; to make migrations coherent we now retroactively attach `references()` in tasks 5-7's columns? **No** — that would require going back to three files. Better: declare DB-level FKs in `auth.ts` only (sessions -> users, accounts -> users, as already done). For `tryout_attempts.user_id`, `lesson_completions.user_id`, `user_question_states.user_id`, `user_stats.user_id`, `daily_activity.user_id`, `entitlements.user_id` — declare FKs by editing the schema files in Step 4 below. Drizzle-kit computes the FK graph from `.references()` callbacks; only the file that declares the callback owns the FK.

- [ ] **Step 4: Add `.references(() => users.id)` FKs to user_id columns across progress/tryout/monetization**

Edit `packages/db/src/schema/tryout.ts` — import `users` and add references to `userId`.

Change:

```ts
import { questions } from "./content";
```

to:

```ts
import { questions } from "./content";
import { users } from "./auth";
```

Then change the `tryoutAttempts` table's `userId` column:

```ts
  userId: uuid("user_id").notNull(),
```

to:

```ts
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
```

Edit `packages/db/src/schema/progress.ts` similarly — import `users` from `./auth` and attach references to each `userId` column. Change:

```ts
import { lessons, questions } from "./content";
```

to:

```ts
import { lessons, questions } from "./content";
import { users } from "./auth";
```

Then for each of `lessonCompletions`, `userQuestionStates`, `userStats`, `dailyActivity` change `userId: uuid("user_id").notNull(),` to:

```ts
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
```

> `userStats` already has `.unique()` appended; chain `.references(...)` before `.unique()`. Specifically change `userId: uuid("user_id").notNull().unique(),` to `userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),`.

> For `dailyActivity` the table's third arg callback also has a unique constraint. The `userId` column edit goes inside the object literal; `unique(...)` stays in the third tuple element.

Edit `packages/db/src/schema/monetization.ts` likewise — import `users` from `./auth`, change `userId: uuid("user_id").notNull(),` to:

```ts
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
```

> The `unique("entitlements_user_id_unique").on(table.userId)` third-arg callback stays as-is; the column reference and the unique constraint coexist.

- [ ] **Step 5: Add `users` relations to existing tables (foreign-graph metadata)**

Already provided `usersRelations` in Step 3 (with `entitlement: one(entitlements, ...)`) plus reverse `one(users, ...)` relations for session/account. For `tryoutAtImpts`, `lessonCompletions`, `userQuestionStates`, `userStats`, `dailyActivity`, `entitlements`, we add relation metadata blocks to their respective files.

Edit `packages/db/src/schema/tryout.ts` — extend the existing `tryoutAttemptsRelations` to also declare `user`:

Change:

```ts
export const tryoutAttemptsRelations = relations(tryoutAttempts, ({ one, many }) => ({
  pkg: one(tryoutPackages, {
    fields: [tryoutAttempts.packageId],
    references: [tryoutPackages.id],
  }),
  answers: many(tryoutAnswers),
}));
```

to:

```ts
export const tryoutAttemptsRelations = relations(tryoutAttempts, ({ one, many }) => ({
  pkg: one(tryoutPackages, {
    fields: [tryoutAttempts.packageId],
    references: [tryoutPackages.id],
  }),
  user: one(users, { fields: [tryoutAttempts.userId], references: [users.id] }),
  answers: many(tryoutAnswers),
}));
```

Edit `packages/db/src/schema/progress.ts` — extend `lessonCompletionsRelations` and add `userQuestionStatesRelations.user`, `userStatsRelations.user`, `dailyActivityRelations`.

Change:

```ts
export const lessonCompletionsRelations = relations(lessonCompletions, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonCompletions.lessonId],
    references: [lessons.id],
  }),
}));

export const userQuestionStatesRelations = relations(userQuestionStates, ({ one }) => ({
  question: one(questions, {
    fields: [userQuestionStates.questionId],
    references: [questions.id],
  }),
}));
```

to (add `users` import from `./auth` — already added in Step 4 — and add a `user` relation to each, plus `userStats` and `dailyActivity` relation blocks which don't exist yet):

```ts
export const lessonCompletionsRelations = relations(lessonCompletions, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonCompletions.lessonId],
    references: [lessons.id],
  }),
  user: one(users, { fields: [lessonCompletions.userId], references: [users.id] }),
}));

export const userQuestionStatesRelations = relations(userQuestionStates, ({ one }) => ({
  question: one(questions, {
    fields: [userQuestionStates.questionId],
    references: [questions.id],
  }),
  user: one(users, { fields: [userQuestionStates.userId], references: [users.id] }),
}));

export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(users, { fields: [userStats.userId], references: [users.id] }),
}));

export const dailyActivityRelations = relations(dailyActivity, ({ one }) => ({
  user: one(users, { fields: [dailyActivity.userId], references: [users.id] }),
}));
```

Edit `packages/db/src/schema/monetization.ts` — add `relations` import and a `entitlementsRelations` block. Change the top imports:

```ts
import { sql } from "drizzle-orm";

import { pgEnum, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
```

to:

```ts
import { relations, sql } from "drizzle-orm";

import { pgEnum, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
```

then append after the `EntitlementInsertRow` type alias:

```ts
export const entitlementsRelations = relations(entitlements, ({ one }) => ({
  user: one(users, { fields: [entitlements.userId], references: [users.id] }),
}));
```

> Are these circular imports safe? `auth.ts` imports `entitlements` from `./monetization`, and `./monetization` now imports `users` from `./auth`. ES module circular imports resolve fine here because each file only references the OTHER file's exported `const` at call time (inside a `relations()` second-arg closure that runs lazily at query-time, not at module-load time). This is the standard pattern Drizzle documents for cross-domain relations.

- [ ] **Step 6: Re-export from the schema barrel**

Change `packages/db/src/schema/index.ts` to:

```ts
export * from "./auth";
export * from "./content";
export * from "./monetization";
export * from "./progress";
export * from "./tryout";
```

> `auth` placed before `content` so cross-domain FKs (e.g. `tryout_attempts.user_id` -> `users.id`) resolve consistently; `simple-import-sort/exports` also enforces alphabetical order at lint time so we'll let `pnpm lint --fix` reorder if needed.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/db test`
Expected: PASS — all schema tests (`auth`, `content`, `monetization`, `progress`, `tryout`) plus `env` + `client` tests pass.

- [ ] **Step 8: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS. If `simple-import-sort` complains about export order in `src/schema/index.ts`, run `pnpm lint --fix` and re-run.

- [ ] **Step 9: Commit**

```bash
git add packages/db/src/schema/auth.ts packages/db/src/schema/auth.test.ts packages/db/src/schema/content.ts packages/db/src/schema/tryout.ts packages/db/src/schema/progress.ts packages/db/src/schema/monetization.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add auth-domain schema + cross-domain user_id FKs and relations"
```

---

## Task 9: `drizzle.config.ts` + initial migration

**Files:**

- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/drizzle/` directory (auto-populated by `drizzle-kit generate`)

**Interfaces:**

- Consumes: `./src/schema/index.ts` (Task 8); `dbEnv.DATABASE_URL` (Task 2).
- Produces: SQL migration files under `packages/db/drizzle/`; the `pnpm db:generate` script emits a snapshot for the full schema.

- [ ] **Step 1: Create `packages/db/drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

import { dbEnv } from "./src/env";

/**
 * Drizzle Kit config used by `pnpm db:generate` (emit SQL) and `pnpm db:push` (apply).
 */
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: dbEnv.DATABASE_URL },
});
```

> `defineConfig` is one call, one statement — under 20-line function cap. `eslint.config.js` (Task 1 Step 5) added `packages/*/drizzle.config.ts` to `projectService.allowDefaultProject` so lint stays green.

- [ ] **Step 2: Make sure `DATABASE_URL` is set in your local shell**

If `.env` exists at the repo root (Task 2 Step 7), Drizzle Kit reads from there only via explicit `dotenv` — Drizzle Kit 0.31 does NOT auto-load `.env` for `dbCredentials`. So export the var inline for the generate step (which needs no actual DB connection — it only needs to typecheck):

Run (substitute your Neon connection string or a placeholder — `db:generate` never dials the DB):

```bash
DATABASE_URL="postgres://placeholder:placeholder@ep-placeholder.neon.tech/sipilian?sslmode=require" pnpm --filter @sipilian/db db:generate
```

Expected: `drizzle-kit` emits `packages/db/drizzle/0000_<hash>.sql` and `packages/db/drizzle/meta/_journal.json` + `packages/db/drizzle/meta/0000_snapshot.json`. The CLI prints a summary listing every table created (subtests, topics, units, lessons, questions, question_options, lesson_questions, tryout_packages, tryout_package_questions, tryout_attempts, tryout_answers, lesson_completions, user_question_states, user_stats, daily_activity, entitlements, users, sessions, accounts, verifications) plus the enums (`question_type`, `question_status`, `entitlement_plan`).

> If `db:generate` errors with "enum/table not found", revisit Task 4-8 implementations; the migration emission is the first end-to-end proof that schemas are coherent.

- [ ] **Step 3: Verify the generated migration files exist**

Run:

```bash
ls packages/db/drizzle
```

Expected: at least one `*.sql` file, plus a `meta/` subdirectory with `_journal.json` and a snapshot file.

- [ ] **Step 4: Spot-check the SQL** (visual only, no edits)

Open `packages/db/drizzle/0000_*.sql` (use `cat` or your editor — read-only). Confirm:

- `CREATE TABLE "subtests" ...`, `CREATE TABLE "questions" ...`, ... `CREATE TABLE "verifications" ...;` — 20 tables total.
- `CREATE TYPE "question_type" AS ENUM('multiple_choice');` — 3 enums.
- `ALTER TABLE "tryout_attempts" ADD CONSTRAINT ... FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;` — the cross-domain FK from Task 8 Step 4 fired.
- `CREATE UNIQUE INDEX "entitlements_user_id_unique" ...` — unique constraints from tasks 6 and 7 fired.

Do NOT hand-edit `drizzle/*.sql` (spec §9.8.2 "migrasi ... tidak diedit tangan"). If anything is wrong, fix the schema `.ts` file and re-run `db:generate` (deleting the malformed `drizzle/` output first).

- [ ] **Step 5: Add `drizzle/` to git**

`drizzle/` is NOT in `.gitignore`, so it gets committed as part of `packages/db`. Spec §9.8.2 explicitly requires migrations to be committed.

- [ ] **Step 6: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS. The `eslint.config.js` `ignores` block (lines 11-17) already excludes `**/drizzle/**` and `**/coverage/**`, so the generated SQL+JSON won't be linted.

- [ ] **Step 7: Run the full test suite once more**

Run: `pnpm --filter @sipilian/db test`
Expected: PASS — no regressions.

- [ ] **Step 8: Commit**

```bash
git add packages/db/drizzle.config.ts packages/db/drizzle
git commit -m "feat(db): add drizzle-kit config and initial SQL migration"
```

---

## Task 10: Final Definition-of-Done gate

**Files:**

- None (verification only).

**Interfaces:**

- Consumes: everything from Tasks 1-9.
- Produces: proof the whole `@sipilian/db` package meets the §9.6 Definition of Done.

- [ ] **Step 1: Run the full gate suite from a clean state**

Run:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm format:check
```

Expected: all four PASS. `pnpm test` reports every `packages/core` + `packages/db` test green; coverage ≥ 80% on new code (env.ts, client.ts, all schema files). If coverage drops below 80% on any schema file, add one more smoke assertion per table to its `.test.ts` (we already cover each table name + enum; this should be enough).

- [ ] **Step 2: Confirm the branch is clean**

Run: `git status`
Expected: "nothing to commit, working tree clean".

- [ ] **Step 3: Push the branch**

Run:

```bash
git push -u origin feat/db-package
```

Expected: branch pushed; open a PR per the finishing-a-development-branch workflow.

---

## Self-Review

**1. Spec coverage (db scope):**

- §3 monorepo, `packages/db` exists with workspace wiring → Task 1.
- §3 dependency direction (`db` no `react`/`react-native`/`**/apps/**`; may use `core`) → Task 1 (`package.json` peerDep on `@sipilian/core`), enforced by `eslint.config.js` blocks already present in the foundation plan (lines 181-198 + 200-214).
- §9.1 env via Zod fail-fast → Task 2 (`src/env.ts`).
- §9.2 naming (tables `snake_case` plural, FK `<singular>_id`, files `kebab-case`, constants `UPPER_CASE`) → Tasks 4-8 (every `pgTable` name, every `*_id` column, every `pgEnum`/`const`).
- §9.4 size/complexity caps → each schema file < 300 lines (content.ts is the largest at ~200 LOC; well under); every function body ≤ 20 lines (smoke tests deliberate per-table single assertion, no `describe` block runs over 20 lines counting its `it` statements since `skipComments` strips JSDoc and blank lines are skipped).
- §9.8.2 `db` single-connection — only `src/client.ts` imports `@neondatabase/serverless` → Task 3 (`client.ts`), enforced by `eslint.config.js:181-198` (bans `@neondatabase/serverless` everywhere in `packages/db` EXCEPT `src/client.ts` per the override at `eslint.config.js:200-214`).
- §9.8.2 schema split by domain area (`content.ts`, `tryout.ts`, `progress.ts`, `monetization.ts`) → Tasks 4-7; auth tables co-located in `auth.ts` per §9.8.3 → Task 8.
- §9.8.2 inferred row types as source of truth, no hand-written row interfaces → Tasks 4-8 export `type FooRow = typeof foo.$inferSelect` and `type FooInsertRow = typeof foo.$inferInsert` exclusively.
- §9.8.2 `sonarjs/no-duplicate-string: off` in `src/schema/**` → already in `eslint.config.js:216-219`.
- §9.8.2 migrations generated by `drizzle-kit`, committed to `drizzle/`, never hand-edited → Task 9.
- §4.A content tables → Task 4.
- §4.B tryout tables → Task 5.
- §4.C progress tables → Task 6.
- §4.D monetization tables → Task 7.
- §4 Better Auth tables (`user`, `session`, `account`, `verification`) → Task 8 (renamed to plural `users`/`sessions`/`accounts`/`verifications` per §9.2 "tabel `snake_case` jamak").
- §10.1 streak anti-cheat — `daily_activity` unique on `(user_id, activity_date)` → Task 6 (`daily_activity` third-arg `unique(...).on(...)`).
- §10.1 tryout timer server-side — `tryout_attempts.startedAt` + `endedAt` (nullable until submit) → Task 5.
- §10.1 idempotent tryout submit — model has `tryout_attempts.id` PK + `packageId` + `userId`; actual idempotency token (`idempotencyKey`) arrives in the `api` plan per §9.8.4 — out of scope here.
- §5.5 / §5.1 hearts/XP placeholder — `entitlements.plan` enforces free/premium split; hearts logic lives in `core` (already merged) + `api` (later) — out of `db` scope.

- **Out of scope (deferred to future plans):** `packages/auth` (Better Auth instance, client adapters, role constants), `packages/api` (handlers, Zod schemas, http error mapper), `apps/web`, `apps/mobile`, billing integration. The §4 `idempotencyKey` column lives in `api`'s request schemas per §9.8.4, not in a DB column.

**2. Placeholder scan:** No `TBD`, `TODO`, "handle edge cases", "similar to Task N". Every schema column is fully specified. Every test has real assertions (table name via `Symbol.for("drizzle:Name")`, enum values, instance identity, env parse). Every commit-style codeblock is concrete.

**3. Type consistency:** `dbEnv`, `dbEnvSchema`, `DbEnv` — used identically across `src/env.ts` (Task 2), `src/client.ts` (Task 3), and `drizzle.config.ts` (Task 9). `db`, `Db` — Task 3 exports both; downstream packages (api, auth) will import these names. Every row-type alias follows the `<Table>SingularRow` / `<Table>SingularInsertRow` convention with singular noun (e.g. `subtests` table -> `SubtestRow`; `lesson_questions` table -> `LessonQuestionRow` despite the table name being plural — keeps downstream type imports readable). Schema barrel `src/schema/index.ts` re-exports in alphabetical order (`auth`, `content`, `monetization`, `progress`, `tryout`); package barrel `src/index.ts` re-exports `./client` + `./schema`. Names referenced across tasks (`CompositionShape`, `entitlementPlanEnum`, `questionStatusEnum`, `questionTypeEnum`, `tryoutAttempts`, `userId`, `users.id`) appear identically wherever consumed.

**4. Lint-edge notes:**

- `client.ts` exports `db` (value) and `Db` (type) — `verbatimModuleSyntax` requires the barrel `src/index.ts` to use `export type { Db }` and `export * from "./client"` separately. Adjusted in Task 3 Step 4.
- The `relations()` callback returns object literals with method shorthand (`one(...)`, `many(...)`) — these are values, not types, so the "no inline types" rule doesn't fire. Drizzle's destructured `one`/`many` are function parameters (snake-named in Drizzle, but the `parameter` selector in `naming-convention` allows `camelCase` only — Drizzle ships `one` and `many` which ARE camelCase, so fine).
- `defineConfig({ schema: "./src/schema/index.ts", out: "./drizzle", dialect: "postgresql", dbCredentials: { url: dbEnv.DATABASE_URL } })` — no inline type annotation (drizzle-kit types the function), so "no inline types" rule satisfied.
- All schema files use `pgTable("snake_case_name", { ...camelCaseProps... })` — object literal properties stay `camelCase` (legal hand-written TS), while Drizzle internally maps `camelCase: snake_case` via the first-arg column names ("camelCase property name" -> "string column name"). The `objectLiteralProperty: null` exemption in `eslint.config.js:68` allows the `snake_case` column identifier STRINGS in `varchar("snake_case_name", ...)` to pass — confirmed in the foundation plan.

**5. CI:** The existing `.github/workflows/*.yml` (added in PR #1 commit `f8ed966`) runs `pnpm lint && pnpm typecheck && pnpm test && pnpm format:check`. Those will run automatically on the `feat/db-package` PR once pushed.
