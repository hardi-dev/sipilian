# Sipilian Foundation + `packages/core` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Sipilian monorepo skeleton with all §9 quality gates green, then build `packages/core` (pure, I/O-free domain logic: `Result`, CAT scoring, spaced repetition, XP, streak) via strict TDD.

**Architecture:** pnpm workspaces + Turborepo monorepo. A single root ESLint flat config enforces every §9 rule (strict TS, SonarJS, size/complexity caps, JSDoc, import sort, naming, padding lines, dependency-direction `no-restricted-imports`). `packages/core` holds only pure functions — no DB, no UI, no framework — and is the most heavily tested unit. All domain errors use a `Result<T, E>` type rather than throwing.

**Tech Stack:** TypeScript 5 (`strict`), pnpm 10, Turborepo 2, ESLint 9 flat config, typescript-eslint 8, eslint-plugin-sonarjs 3, @stylistic/eslint-plugin, eslint-plugin-jsdoc, eslint-plugin-simple-import-sort, Prettier 3, Vitest 2 + @vitest/coverage-v8.

## Global Constraints

These apply to **every** task. Copied verbatim from the spec §9.

- **TypeScript `strict: true`** in all packages; never `any` — use `unknown` + narrowing.
- **Dependency direction enforced** via `no-restricted-imports`: `core` must not import `@sipilian/db`, `drizzle-orm`, `@neondatabase/serverless`, `react`, `react-native`, or `**/apps/**`.
- **`core` determinism (spec §9.8.1):** no current-time/random reads in `core` — `Date.now`, no-arg `new Date()`, `Math.random`, `setTimeout`/`setInterval` are lint-banned; inject time/randomness as parameters. Deterministic `Date.parse`/`new Date(iso)`/`Math.max` stay allowed.
- **`db` single connection (spec §9.8.2):** only `packages/db/src/client.ts` may import `@neondatabase/serverless`; every other file uses the shared `db` instance.
- **No business logic in UI**; domain rules live in `core`.
- **JSDoc mandatory** on every function declaration, method, and named arrow — **no `@example`**, **no types in JSDoc** (types come from TS).
- **No inline types:** every object type and literal-union annotation must be a named `interface`/`type`.
- **Naming:** files `kebab-case`; React components `PascalCase`; variables/functions `camelCase`; constants `UPPER_CASE`; DB tables `snake_case` plural. `snake_case` keys only via object literals (Zod) & inferred Drizzle types — hand-written `interface`/`type` properties stay `camelCase`.
- **Size/complexity caps (all `.ts` AND `.tsx`, no exceptions):** `max-lines` 300 (skip blank/comment); `max-lines-per-function` **20** (skip blank/comment, incl. React components); `max-params` 4; `max-depth` 3; `max-nested-callbacks` 3; `complexity` 10; `sonarjs/cognitive-complexity` 10.
- **Error handling:** `core` returns `Result<Ok | Err>` for expected errors (no throw); unexpected bugs may throw.
- **Padding lines (`@stylistic/padding-line-between-statements`, blocking, auto-fixable):** blank line after `import` block / directive / `const|let|var` (consecutive same-kind may stay adjacent); blank line before `return`; blank line before & after `if/for/while/switch/try/function/class`.
- **Definition of Done per task:** tests pass · lint clean (incl. SonarJS + size caps) · typecheck passes · coverage of new code ≥ 80%.
- **Commits:** Conventional Commits; work on a branch, never straight to `main`.

**Branch:** before Task 1, create the working branch:

```bash
git checkout -b feat/foundation-and-core
```

---

## File Structure

**Part A — Foundation**

- Create: `pnpm-workspace.yaml` — workspace globs.
- Create: `package.json` (root) — private, `type: module`, workspace scripts, dev deps.
- Create: `turbo.json` — `lint` / `typecheck` / `test` task graph.
- Create: `tsconfig.base.json` — shared strict compiler options.
- Create: `.prettierrc.json`, `.prettierignore` — formatting.
- Create: `eslint.config.js` — the single flat config enforcing all §9 rules.
- Create: `AGENTS.md` — §9 rules restated for humans + agents.
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts` — the package that everything type-checks/lints against.

**Part B — `packages/core` (each file one responsibility)**

- Create: `packages/core/src/result.ts` — `Result`/`Ok`/`Err` + `ok`/`err`/`isOk`/`isErr`.
- Create: `packages/core/src/domain.ts` — `SubtestKind`, `SUBTEST_KINDS`.
- Create: `packages/core/src/scoring.ts` — `ScoringError`, objective + TKP + tryout scoring.
- Create: `packages/core/src/spaced-repetition.ts` — `ReviewState`, `scheduleReview` (SM-2 lite).
- Create: `packages/core/src/gamification.ts` — `calculateXp`, `updateStreak`.
- Modify: `packages/core/src/index.ts` — re-export the public surface as each task lands.
- Test: colocated `*.test.ts` beside each source file.

---

## Task 1: Root workspace scaffold

**Files:**

- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `turbo.json`

**Interfaces:**

- Consumes: nothing.
- Produces: pnpm workspace resolving `apps/*` and `packages/*`; root scripts `lint`, `typecheck`, `test`, `format`, `format:check`; Turbo tasks `lint`/`typecheck`/`test`.

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "sipilian",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.14.0",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "devDependencies": {}
}
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^test"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    }
  }
}
```

- [ ] **Step 4: Install Turborepo at the root**

Run: `pnpm add -D -w turbo@^2.3.0`
Expected: `turbo` appears under root `devDependencies`; `pnpm-lock.yaml` is created.

- [ ] **Step 5: Verify pnpm sees the workspace**

Run: `pnpm -w exec turbo --version`
Expected: prints a `2.x` version with no error.

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml package.json turbo.json pnpm-lock.yaml
git commit -m "chore: scaffold pnpm + turborepo workspace"
```

---

## Task 2: Shared strict TypeScript base config

**Files:**

- Create: `tsconfig.base.json`

**Interfaces:**

- Consumes: nothing.
- Produces: `tsconfig.base.json` that per-package `tsconfig.json` files extend.

- [ ] **Step 1: Install TypeScript at the root**

Run: `pnpm add -D -w typescript@^5.7.0`
Expected: `typescript` under root `devDependencies`.

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "noEmit": true
  }
}
```

- [ ] **Step 3: Verify the config parses**

Run: `pnpm -w exec tsc --showConfig -p tsconfig.base.json`
Expected: prints the resolved config JSON with `"strict": true`; no error.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.base.json package.json pnpm-lock.yaml
git commit -m "chore: add shared strict tsconfig base"
```

---

## Task 3: `packages/core` package scaffold

**Files:**

- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: `tsconfig.base.json` (Task 2).
- Produces: `@sipilian/core` package with a `typecheck` script; a lint-compliant `src/index.ts` so later tooling has real TS to check.

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@sipilian/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `packages/core/src/index.ts`**

```ts
export const CORE_PACKAGE_NAME = "@sipilian/core";
```

- [ ] **Step 4: Install the workspace so `@sipilian/core` is linked**

Run: `pnpm install`
Expected: completes with no error; `packages/core` recognized as a workspace package.

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm -w exec turbo run typecheck`
Expected: PASS — `@sipilian/core#typecheck` succeeds with no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core package.json pnpm-lock.yaml
git commit -m "chore: scaffold @sipilian/core package"
```

---

## Task 4: Prettier

**Files:**

- Create: `.prettierrc.json`
- Create: `.prettierignore`

**Interfaces:**

- Consumes: nothing.
- Produces: repo-wide formatting via `pnpm format` / `pnpm format:check`.

- [ ] **Step 1: Install Prettier**

Run: `pnpm add -D -w prettier@^3.4.0`
Expected: `prettier` under root `devDependencies`.

- [ ] **Step 2: Create `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 3: Create `.prettierignore`**

```gitignore
node_modules
dist
.turbo
drizzle
pnpm-lock.yaml
```

- [ ] **Step 4: Verify formatting is clean**

Run: `pnpm format:check`
Expected: PASS — "All matched files use Prettier code style!" (run `pnpm format` first if it reports diffs).

- [ ] **Step 5: Commit**

```bash
git add .prettierrc.json .prettierignore package.json pnpm-lock.yaml
git commit -m "chore: add prettier config"
```

---

## Task 5: ESLint flat config enforcing all §9 rules

**Files:**

- Create: `eslint.config.js`

**Interfaces:**

- Consumes: `packages/core/src/index.ts` (Task 3) as the file to lint; `tsconfig.base.json` (Task 2) via `projectService`.
- Produces: `pnpm lint` enforcing strict TS, SonarJS, size/complexity caps, JSDoc, import sort, naming, padding lines, and per-package `no-restricted-imports`.

- [ ] **Step 1: Install ESLint and all plugins**

Run:

```bash
pnpm add -D -w eslint@^9.18.0 @eslint/js@^9.18.0 typescript-eslint@^8.20.0 \
  @stylistic/eslint-plugin@^2.13.0 eslint-plugin-simple-import-sort@^12.1.0 \
  eslint-plugin-jsdoc@^50.6.0 eslint-plugin-sonarjs@^3.0.0 \
  eslint-config-prettier@^9.1.0 globals@^15.14.0
```

Expected: all packages appear under root `devDependencies`.

- [ ] **Step 2: Create `eslint.config.js`**

```js
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import prettier from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/drizzle/**", "**/.turbo/**", "**/node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    plugins: {
      "@stylistic": stylistic,
      "simple-import-sort": simpleImportSort,
      jsdoc,
      sonarjs,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      jsdoc: { mode: "typescript" },
    },
    rules: {
      ...sonarjs.configs.recommended.rules,
      "sonarjs/cognitive-complexity": ["error", 10],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSTypeAnnotation > TSTypeLiteral",
          message: "Inline object types are banned. Extract a named interface/type.",
        },
        {
          selector: "TSTypeAnnotation > TSUnionType > TSLiteralType",
          message: "Inline literal unions are banned. Extract a named type.",
        },
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"] },
        { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
        { selector: "parameter", format: ["camelCase"], leadingUnderscore: "allow" },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase", "UPPER_CASE"] },
        {
          selector: "variable",
          modifiers: ["const", "exported"],
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
        },
        { selector: "objectLiteralProperty", format: null },
        { selector: "import", format: ["camelCase", "PascalCase"] },
      ],
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": [
        "error",
        { max: 20, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      "max-params": ["error", 4],
      "max-depth": ["error", 3],
      "max-nested-callbacks": ["error", 3],
      complexity: ["error", 10],
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: false,
          require: { FunctionDeclaration: true, MethodDefinition: true },
          contexts: ["VariableDeclarator > ArrowFunctionExpression"],
        },
      ],
      "jsdoc/no-types": "error",
      "jsdoc/check-alignment": "error",
      "jsdoc/check-param-names": "error",
      "jsdoc/check-tag-names": ["error", { typed: true }],
      "jsdoc/require-description": "error",
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/require-param-type": "off",
      "jsdoc/require-returns-type": "off",
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "any", prev: "import", next: "import" },
        { blankLine: "always", prev: "directive", next: "*" },
        { blankLine: "any", prev: "directive", next: "directive" },
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"],
        },
        { blankLine: "always", prev: "*", next: "return" },
        {
          blankLine: "always",
          prev: "*",
          next: ["if", "for", "while", "switch", "try", "function", "class"],
        },
        {
          blankLine: "always",
          prev: ["if", "for", "while", "switch", "try", "function", "class"],
          next: "*",
        },
      ],
    },
  },
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@sipilian/db", message: "core must stay pure: no DB imports." },
            { name: "drizzle-orm", message: "core must stay pure: no DB imports." },
            {
              name: "@neondatabase/serverless",
              message: "core must stay pure: no DB imports.",
            },
            { name: "react", message: "core must stay UI-free." },
            { name: "react-native", message: "core must stay UI-free." },
          ],
          patterns: ["**/apps/**"],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "core must be deterministic: inject randomness as a parameter.",
        },
        {
          object: "Date",
          property: "now",
          message: "core must be deterministic: inject the current time as a parameter.",
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "setTimeout", message: "core must be deterministic: no timers." },
        { name: "setInterval", message: "core must be deterministic: no timers." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSTypeAnnotation > TSTypeLiteral",
          message: "Inline object types are banned. Extract a named interface/type.",
        },
        {
          selector: "TSTypeAnnotation > TSUnionType > TSLiteralType",
          message: "Inline literal unions are banned. Extract a named type.",
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            "core must be deterministic: pass time in; don't call new Date() for the current time.",
        },
      ],
    },
  },
  {
    files: ["packages/db/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "db layer must stay UI-free." },
            { name: "react-native", message: "db layer must stay UI-free." },
            {
              name: "@neondatabase/serverless",
              message:
                "Only packages/db/src/client.ts may construct the Neon connection; import the shared db elsewhere.",
            },
          ],
          patterns: ["**/apps/**"],
        },
      ],
    },
  },
  {
    files: ["packages/db/src/client.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "db layer must stay UI-free." },
            { name: "react-native", message: "db layer must stay UI-free." },
          ],
          patterns: ["**/apps/**"],
        },
      ],
    },
  },
  {
    files: ["packages/db/src/schema/**/*.ts"],
    rules: {
      "sonarjs/no-duplicate-string": "off",
    },
  },
  {
    files: ["**/*.test.ts", "**/vitest.config.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "jsdoc/require-jsdoc": "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "sonarjs/no-duplicate-string": "off",
      "no-restricted-properties": "off",
      "no-restricted-globals": "off",
    },
  },
  prettier,
);
```

> **Why the core block re-declares `no-restricted-syntax`:** flat-config rule
> values replace (not merge) on the last matching config. Because the core block
> adds a `new Date()` guard under the same rule key, it must also repeat the two
> global inline-type/union selectors — otherwise core files would silently lose
> them. Deterministic date math stays legal: `Date.parse(...)`, `new Date(iso)`,
> and `Math.max/round/abs` are all allowed; only current-time/random reads are
> banned.

- [ ] **Step 3: Verify lint runs clean against the core stub**

Run: `pnpm lint`
Expected: PASS — no errors (the only TS file, `packages/core/src/index.ts`, is compliant).

- [ ] **Step 4: Prove the config actually bites (temporary check, do not commit)**

Create `packages/core/src/scratch.ts` with a deliberately non-compliant function, then lint it:

```ts
export function bad(x: number) {
  return x;
}
```

Run: `pnpm lint`
Expected: FAIL with `jsdoc/require-jsdoc` (missing JSDoc) and `@typescript-eslint/naming-convention` / padding errors. Then delete the file:

```bash
rm packages/core/src/scratch.ts
```

Run `pnpm lint` again → PASS.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.js package.json pnpm-lock.yaml
git commit -m "chore: add eslint flat config enforcing all quality rules"
```

---

## Task 6: Vitest with coverage

**Files:**

- Create: `packages/core/vitest.config.ts`
- Modify: `packages/core/package.json` (add `test` script + dev deps)

**Interfaces:**

- Consumes: `@sipilian/core` package (Task 3).
- Produces: `pnpm test` running Vitest in `packages/core` with v8 coverage and an 80% threshold on new code.

- [ ] **Step 1: Install Vitest + coverage in `packages/core`**

Run: `pnpm add -D --filter @sipilian/core vitest@^2.1.0 @vitest/coverage-v8@^2.1.0`
Expected: both under `packages/core` `devDependencies`.

- [ ] **Step 2: Create `packages/core/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
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

- [ ] **Step 3: Add the `test` script to `packages/core/package.json`**

Change the `scripts` block to:

```json
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage"
  },
```

- [ ] **Step 4: Add a temporary smoke test to prove the runner works**

Create `packages/core/src/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { CORE_PACKAGE_NAME } from "./index";

describe("core package", () => {
  it("exposes its package name", () => {
    expect(CORE_PACKAGE_NAME).toBe("@sipilian/core");
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test`
Expected: PASS — 1 test passes, coverage report prints.

- [ ] **Step 6: Remove the smoke test (real tests arrive in Part B)**

```bash
rm packages/core/src/smoke.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/vitest.config.ts packages/core/package.json package.json pnpm-lock.yaml
git commit -m "chore: add vitest with coverage to @sipilian/core"
```

---

## Task 7: `AGENTS.md`

**Files:**

- Create: `AGENTS.md`

**Interfaces:**

- Consumes: spec §9.
- Produces: the canonical rules file for humans + agents.

- [ ] **Step 1: Create `AGENTS.md`**

```markdown
# Sipilian — Working Agreement (Humans & Agents)

These rules mirror the design spec §9 and are enforced by `pnpm lint` / `pnpm typecheck` / `pnpm test`. All are blocking in CI.

## Principles

- TypeScript `strict: true` everywhere; never `any` — use `unknown` + narrowing.
- No business logic in UI. Domain rules live in `packages/core` as pure, I/O-free functions returning `Result<Ok | Err>` for expected errors.
- One source of truth for types: Drizzle schema infers DB types; Zod validates input at API boundaries and is shared mobile ↔ web.

## Dependency direction (enforced by `no-restricted-imports`)

- `core` must not import `@sipilian/db`, `drizzle-orm`, `@neondatabase/serverless`, `react`, `react-native`, or anything under `apps/`.
- `db` must not import `react`, `react-native`, or anything under `apps/` (may use `core`).

## Naming

- Files `kebab-case`; React components `PascalCase`; vars/functions `camelCase`; constants `UPPER_CASE`; DB tables `snake_case` plural.
- `snake_case` keys only via object literals (Zod) and inferred Drizzle types. Hand-written interface/type properties stay `camelCase`.

## Size & complexity caps (all `.ts` AND `.tsx`)

- `max-lines` 300 · `max-lines-per-function` 20 · `max-params` 4 · `max-depth` 3 · `max-nested-callbacks` 3 · `complexity` 10 · `sonarjs/cognitive-complexity` 10.
- Blank/comment lines are skipped in line counts. React components are decomposed aggressively to satisfy the 20-line function cap.

## JSDoc

- Mandatory on every function declaration, method, and named arrow. No `@example`. No types in JSDoc (types come from TS).

## No inline types

- Every object type and literal-union annotation must be a named `interface`/`type`.

## Spacing (`@stylistic/padding-line-between-statements`, auto-fixable)

- Blank line after `import` block / directive / `const|let|var` (consecutive same-kind may stay adjacent).
- Blank line before `return`.
- Blank line before & after `if/for/while/switch/try/function/class`.

## Module-specific rules (spec §9.8)

`(lint)` = machine-enforced/blocking · `(convention)` = enforced via review.

- **`core`:** pure & deterministic — no `Date.now`, no-arg `new Date()`, `Math.random`, or timers; inject time/randomness. `Date.parse`/`new Date(iso)`/`Math.max` are fine. Barrel-only public surface (no deep imports). `Result`, never `throw` for expected errors. `(lint)`
- **`db`:** schema split by domain area; **only `src/client.ts`** may import `@neondatabase/serverless` — everything else uses the shared `db`. Inferred `$inferSelect`/`$inferInsert` are the row-type source of truth; no hand-written row interfaces. `(lint)`
- **`auth`:** client via subpath exports (`@sipilian/auth/client-web`, `/client-expo`); roles as named constants; auth tables' schema stays in `db`. `(lint)`
- **`api`:** feature folders with co-located `*.schema.ts` + `*.handler.ts`; handlers stay thin (parse → delegate to `core`/`db` → map `Result` to HTTP). Handlers must NOT `throw` for expected errors — return mapped HTTP errors. `(convention)`
- **`apps/web`:** admin UI must not import `packages/db` (go through `api`); components never call server functions directly (use hooks); `react`/`react-hooks`/`jsx-a11y` enabled. `(lint)`
- **`apps/mobile`:** feature-based (`features/<name>/{components,hooks,api,screens}`); server-state via TanStack Query, UI-state via Zustand — server data never in Zustand, no business logic in stores `(convention)`; NativeWind-only (no `StyleSheet` import); no `packages/db` import. `(lint + convention)`

## Definition of Done (per task)

- Tests pass · lint clean · typecheck passes · coverage of new code ≥ 80%.

## Commits

- Conventional Commits. Work on a branch; never commit straight to `main`.
```

- [ ] **Step 2: Verify formatting**

Run: `pnpm format:check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add AGENTS.md working agreement"
```

---

## Task 8: Foundation gate check

**Files:**

- None (verification only).

**Interfaces:**

- Consumes: everything from Tasks 1–7.
- Produces: proof that all four gates run green on the skeleton before domain work begins.

- [ ] **Step 1: Run the full gate suite**

Run:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm format:check
```

Expected: all four PASS. `pnpm test` reports 0 test files but exits 0 (no failures). If Vitest exits non-zero on "no tests", that is expected only until Part B adds tests — proceed to Task 9.

- [ ] **Step 2: Commit (marker, if any lockfile churn)**

```bash
git add -A
git commit -m "chore: verify foundation gates green" --allow-empty
```

---

## Task 9: `Result` type (TDD)

**Files:**

- Create: `packages/core/src/result.ts`
- Test: `packages/core/src/result.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `interface Ok<T> { readonly ok: true; readonly value: T }`
  - `interface Err<E> { readonly ok: false; readonly error: E }`
  - `type Result<T, E> = Ok<T> | Err<E>`
  - `ok<T>(value: T): Ok<T>`
  - `err<E>(error: E): Err<E>`
  - `isOk<T, E>(result: Result<T, E>): result is Ok<T>`
  - `isErr<T, E>(result: Result<T, E>): result is Err<E>`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/result.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { err, isErr, isOk, ok } from "./result";

describe("result", () => {
  it("wraps a success value", () => {
    const result = ok(42);

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("wraps an error value", () => {
    const result = err("boom");

    expect(result).toEqual({ ok: false, error: "boom" });
  });

  it("narrows with isOk", () => {
    const result = ok(1);

    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it("narrows with isErr", () => {
    const result = err("bad");

    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/core test`
Expected: FAIL — cannot resolve `./result`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/result.ts`:

```ts
/**
 * Successful result variant carrying a value.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Failed result variant carrying an error.
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Discriminated union representing either success or a handled error.
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Builds a successful result.
 * @param value - The success payload to wrap.
 * @returns An Ok result containing the value.
 */
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

/**
 * Builds a failed result.
 * @param error - The error payload to wrap.
 * @returns An Err result containing the error.
 */
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/**
 * Type guard narrowing a result to its Ok variant.
 * @param result - The result to inspect.
 * @returns True when the result is Ok.
 */
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;

/**
 * Type guard narrowing a result to its Err variant.
 * @param result - The result to inspect.
 * @returns True when the result is Err.
 */
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;
```

- [ ] **Step 4: Re-export from the barrel**

Replace `packages/core/src/index.ts` with:

```ts
export * from "./result";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/core test`
Expected: PASS — 4 tests pass, coverage ≥ 80%.

- [ ] **Step 6: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/result.ts packages/core/src/result.test.ts packages/core/src/index.ts
git commit -m "feat(core): add Result type with ok/err helpers"
```

---

## Task 10: Domain constants (TDD)

**Files:**

- Create: `packages/core/src/domain.ts`
- Test: `packages/core/src/domain.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `type SubtestKind = "twk" | "tiu" | "tkp"`
  - `const SUBTEST_KINDS: readonly SubtestKind[]` = `["twk", "tiu", "tkp"]`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/domain.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { SUBTEST_KINDS } from "./domain";

describe("domain", () => {
  it("lists the three SKD subtests in order", () => {
    expect(SUBTEST_KINDS).toEqual(["twk", "tiu", "tkp"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/core test`
Expected: FAIL — cannot resolve `./domain`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/domain.ts`:

```ts
/**
 * The three SKD subtests: TWK (kebangsaan), TIU (intelegensia), TKP (karakteristik pribadi).
 */
export type SubtestKind = "twk" | "tiu" | "tkp";

export const SUBTEST_KINDS: readonly SubtestKind[] = ["twk", "tiu", "tkp"];
```

- [ ] **Step 4: Re-export from the barrel**

Change `packages/core/src/index.ts` to:

```ts
export * from "./domain";
export * from "./result";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/core test`
Expected: PASS.

- [ ] **Step 6: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain.ts packages/core/src/domain.test.ts packages/core/src/index.ts
git commit -m "feat(core): add SubtestKind domain constants"
```

---

## Task 11: Objective scoring — TWK/TIU (TDD)

**Files:**

- Create: `packages/core/src/scoring.ts`
- Test: `packages/core/src/scoring.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: `SubtestKind` (Task 10); `Result`, `ok`, `err` (Task 9).
- Produces:
  - `type ScoringErrorCode = "negative_correct_count" | "invalid_tkp_weight"`
  - `interface ScoringError { readonly code: ScoringErrorCode; readonly message: string }`
  - `interface SubtestScore { readonly kind: SubtestKind; readonly rawScore: number; readonly passingGrade: number; readonly passed: boolean }`
  - `interface ObjectiveScoreInput { readonly kind: SubtestKind; readonly correctCount: number; readonly passingGrade: number }`
  - `scoreObjectiveSubtest(input: ObjectiveScoreInput): Result<SubtestScore, ScoringError>`
  - `const POINTS_PER_CORRECT = 5` (module-private)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/scoring.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { isErr, isOk } from "./result";
import { scoreObjectiveSubtest } from "./scoring";

describe("scoreObjectiveSubtest", () => {
  it("awards 5 points per correct answer and marks a pass", () => {
    const result = scoreObjectiveSubtest({ kind: "twk", correctCount: 20, passingGrade: 65 });

    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.rawScore).toBe(100);
      expect(result.value.passed).toBe(true);
      expect(result.value.kind).toBe("twk");
    }
  });

  it("marks a fail below the passing grade", () => {
    const result = scoreObjectiveSubtest({ kind: "tiu", correctCount: 10, passingGrade: 80 });

    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.rawScore).toBe(50);
      expect(result.value.passed).toBe(false);
    }
  });

  it("rejects a negative correct count", () => {
    const result = scoreObjectiveSubtest({ kind: "twk", correctCount: -1, passingGrade: 65 });

    expect(isErr(result)).toBe(true);

    if (isErr(result)) {
      expect(result.error.code).toBe("negative_correct_count");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/core test`
Expected: FAIL — cannot resolve `./scoring`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/scoring.ts`:

```ts
import type { SubtestKind } from "./domain";
import { err, ok, type Result } from "./result";

const POINTS_PER_CORRECT = 5;

/**
 * Machine-readable code for a handled scoring failure.
 */
export type ScoringErrorCode = "negative_correct_count" | "invalid_tkp_weight";

/**
 * A handled scoring error returned instead of throwing.
 */
export interface ScoringError {
  readonly code: ScoringErrorCode;
  readonly message: string;
}

/**
 * The score of a single subtest against its passing grade.
 */
export interface SubtestScore {
  readonly kind: SubtestKind;
  readonly rawScore: number;
  readonly passingGrade: number;
  readonly passed: boolean;
}

/**
 * Inputs for scoring an objective (TWK/TIU) subtest.
 */
export interface ObjectiveScoreInput {
  readonly kind: SubtestKind;
  readonly correctCount: number;
  readonly passingGrade: number;
}

/**
 * Scores an objective subtest where each correct answer is worth five points.
 * @param input - The subtest kind, correct-answer count, and passing grade.
 * @returns Ok with the subtest score, or Err when the correct count is negative.
 */
export const scoreObjectiveSubtest = (
  input: ObjectiveScoreInput,
): Result<SubtestScore, ScoringError> => {
  if (input.correctCount < 0) {
    return err({ code: "negative_correct_count", message: "correctCount must be >= 0" });
  }

  const rawScore = input.correctCount * POINTS_PER_CORRECT;

  return ok({
    kind: input.kind,
    rawScore,
    passingGrade: input.passingGrade,
    passed: rawScore >= input.passingGrade,
  });
};
```

- [ ] **Step 4: Re-export from the barrel**

Change `packages/core/src/index.ts` to:

```ts
export * from "./domain";
export * from "./result";
export * from "./scoring";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/core test`
Expected: PASS.

- [ ] **Step 6: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/scoring.ts packages/core/src/scoring.test.ts packages/core/src/index.ts
git commit -m "feat(core): score objective TWK/TIU subtests"
```

---

## Task 12: Weighted scoring — TKP (TDD)

**Files:**

- Modify: `packages/core/src/scoring.ts`
- Modify: `packages/core/src/scoring.test.ts`

**Interfaces:**

- Consumes: `ScoringError`, `SubtestScore`, `Result`, `ok`, `err` (Task 11).
- Produces:
  - `interface TkpScoreInput { readonly selectedWeights: readonly number[]; readonly passingGrade: number }`
  - `scoreTkpSubtest(input: TkpScoreInput): Result<SubtestScore, ScoringError>`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/scoring.test.ts` (add `scoreTkpSubtest` to the existing import from `./scoring`):

```ts
describe("scoreTkpSubtest", () => {
  it("sums the selected option weights (no wrong answers)", () => {
    const result = scoreTkpSubtest({ selectedWeights: [5, 4, 3, 5, 2], passingGrade: 15 });

    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.rawScore).toBe(19);
      expect(result.value.kind).toBe("tkp");
      expect(result.value.passed).toBe(true);
    }
  });

  it("rejects a weight outside the 1..5 range", () => {
    const result = scoreTkpSubtest({ selectedWeights: [5, 6], passingGrade: 10 });

    expect(isErr(result)).toBe(true);

    if (isErr(result)) {
      expect(result.error.code).toBe("invalid_tkp_weight");
    }
  });
});
```

The `./scoring` import line at the top of the test file becomes:

```ts
import { scoreObjectiveSubtest, scoreTkpSubtest } from "./scoring";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/core test`
Expected: FAIL — `scoreTkpSubtest` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `packages/core/src/scoring.ts`:

```ts
/**
 * Inputs for scoring a TKP subtest where every selected option carries a 1..5 weight.
 */
export interface TkpScoreInput {
  readonly selectedWeights: readonly number[];
  readonly passingGrade: number;
}

/**
 * Scores a TKP subtest by summing option weights; there are no wrong answers.
 * @param input - The selected option weights and the passing grade.
 * @returns Ok with the subtest score, or Err when any weight is outside 1..5.
 */
export const scoreTkpSubtest = (input: TkpScoreInput): Result<SubtestScore, ScoringError> => {
  const hasInvalidWeight = input.selectedWeights.some((weight) => weight < 1 || weight > 5);

  if (hasInvalidWeight) {
    return err({ code: "invalid_tkp_weight", message: "TKP weights must be within 1..5" });
  }

  const rawScore = input.selectedWeights.reduce((sum, weight) => sum + weight, 0);

  return ok({
    kind: "tkp",
    rawScore,
    passingGrade: input.passingGrade,
    passed: rawScore >= input.passingGrade,
  });
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/core test`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/scoring.ts packages/core/src/scoring.test.ts
git commit -m "feat(core): score weighted TKP subtests"
```

---

## Task 13: Tryout aggregate scoring (TDD)

**Files:**

- Modify: `packages/core/src/scoring.ts`
- Modify: `packages/core/src/scoring.test.ts`

**Interfaces:**

- Consumes: `SubtestScore` (Task 11).
- Produces:
  - `interface TryoutScore { readonly subtests: readonly SubtestScore[]; readonly totalScore: number; readonly passedAll: boolean }`
  - `scoreTryout(subtests: readonly SubtestScore[]): TryoutScore`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/scoring.test.ts` (add `scoreTryout` and `type SubtestScore` to imports):

```ts
describe("scoreTryout", () => {
  it("passes only when every subtest passes and totals the raw scores", () => {
    const subtests: SubtestScore[] = [
      { kind: "twk", rawScore: 100, passingGrade: 65, passed: true },
      { kind: "tiu", rawScore: 90, passingGrade: 80, passed: true },
      { kind: "tkp", rawScore: 160, passingGrade: 156, passed: true },
    ];

    const result = scoreTryout(subtests);

    expect(result.totalScore).toBe(350);
    expect(result.passedAll).toBe(true);
  });

  it("fails overall when any subtest is below its passing grade", () => {
    const subtests: SubtestScore[] = [
      { kind: "twk", rawScore: 60, passingGrade: 65, passed: false },
      { kind: "tiu", rawScore: 90, passingGrade: 80, passed: true },
      { kind: "tkp", rawScore: 160, passingGrade: 156, passed: true },
    ];

    const result = scoreTryout(subtests);

    expect(result.passedAll).toBe(false);
  });
});
```

The `./scoring` import line becomes:

```ts
import { scoreObjectiveSubtest, scoreTkpSubtest, scoreTryout, type SubtestScore } from "./scoring";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/core test`
Expected: FAIL — `scoreTryout` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `packages/core/src/scoring.ts`:

```ts
/**
 * The aggregate result of a full CAT tryout across all subtests.
 */
export interface TryoutScore {
  readonly subtests: readonly SubtestScore[];
  readonly totalScore: number;
  readonly passedAll: boolean;
}

/**
 * Aggregates per-subtest scores into an overall tryout result.
 * @param subtests - The already-scored subtests making up the tryout.
 * @returns The combined total and whether every subtest passed.
 */
export const scoreTryout = (subtests: readonly SubtestScore[]): TryoutScore => {
  const totalScore = subtests.reduce((sum, subtest) => sum + subtest.rawScore, 0);

  return {
    subtests,
    totalScore,
    passedAll: subtests.every((subtest) => subtest.passed),
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/core test`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/scoring.ts packages/core/src/scoring.test.ts
git commit -m "feat(core): aggregate tryout scoring across subtests"
```

---

## Task 14: Spaced repetition — SM-2 lite (TDD)

**Files:**

- Create: `packages/core/src/spaced-repetition.ts`
- Test: `packages/core/src/spaced-repetition.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `interface ReviewState { readonly repetitions: number; readonly intervalDays: number; readonly easeFactor: number }`
  - `interface ScheduleReviewInput { readonly previous: ReviewState; readonly quality: number }`
  - `scheduleReview(input: ScheduleReviewInput): ReviewState`
  - Module-private constants `MIN_EASE_FACTOR = 1.3`, `SECOND_INTERVAL_DAYS = 6`, and helpers `nextEaseFactor`, `nextInterval`.

Algorithm (simplified SM-2): `quality` is 0–5. If `quality < 3`, the item lapses → `repetitions` resets to 0, `intervalDays` to 1, `easeFactor` unchanged. Otherwise `repetitions` increments; the ease factor updates by `EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))` clamped to a `1.3` floor; the interval is 1 day for the first repetition, 6 for the second, and `round(previousInterval * easeFactor)` thereafter.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/spaced-repetition.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { scheduleReview } from "./spaced-repetition";

const fresh = { repetitions: 0, intervalDays: 0, easeFactor: 2.5 };

describe("scheduleReview", () => {
  it("schedules the first successful review one day out", () => {
    const next = scheduleReview({ previous: fresh, quality: 4 });

    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
  });

  it("schedules the second successful review six days out", () => {
    const afterFirst = { repetitions: 1, intervalDays: 1, easeFactor: 2.5 };

    const next = scheduleReview({ previous: afterFirst, quality: 4 });

    expect(next.repetitions).toBe(2);
    expect(next.intervalDays).toBe(6);
  });

  it("grows later intervals by the ease factor", () => {
    const afterSecond = { repetitions: 2, intervalDays: 6, easeFactor: 2.5 };

    const next = scheduleReview({ previous: afterSecond, quality: 5 });

    expect(next.repetitions).toBe(3);
    expect(next.intervalDays).toBeGreaterThan(6);
  });

  it("resets repetitions on a lapse (quality < 3)", () => {
    const strong = { repetitions: 5, intervalDays: 40, easeFactor: 2.6 };

    const next = scheduleReview({ previous: strong, quality: 1 });

    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.easeFactor).toBe(2.6);
  });

  it("never lets the ease factor fall below 1.3", () => {
    const low = { repetitions: 4, intervalDays: 10, easeFactor: 1.3 };

    const next = scheduleReview({ previous: low, quality: 3 });

    expect(next.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/core test`
Expected: FAIL — cannot resolve `./spaced-repetition`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/spaced-repetition.ts`:

```ts
const MIN_EASE_FACTOR = 1.3;
const SECOND_INTERVAL_DAYS = 6;

/**
 * Per-question spaced-repetition state persisted between reviews.
 */
export interface ReviewState {
  readonly repetitions: number;
  readonly intervalDays: number;
  readonly easeFactor: number;
}

/**
 * Inputs for scheduling the next review of a question.
 */
export interface ScheduleReviewInput {
  readonly previous: ReviewState;
  readonly quality: number;
}

/**
 * Computes the next ease factor, clamped to a lower bound.
 * @param current - The current ease factor.
 * @param quality - The recall quality from 0 to 5.
 * @returns The updated ease factor, never below the floor.
 */
const nextEaseFactor = (current: number, quality: number): number => {
  const gap = 5 - quality;
  const updated = current + (0.1 - gap * (0.08 + gap * 0.02));

  return Math.max(MIN_EASE_FACTOR, updated);
};

/**
 * Computes the next interval in days from the repetition count and ease factor.
 * @param repetitions - The successful-review count including the current one.
 * @param previousInterval - The prior interval in days.
 * @param easeFactor - The current ease factor.
 * @returns The next interval in whole days.
 */
const nextInterval = (
  repetitions: number,
  previousInterval: number,
  easeFactor: number,
): number => {
  if (repetitions <= 1) {
    return 1;
  }

  if (repetitions === 2) {
    return SECOND_INTERVAL_DAYS;
  }

  return Math.round(previousInterval * easeFactor);
};

/**
 * Schedules the next review using a simplified SM-2 algorithm.
 * @param input - The previous review state and the recall quality (0..5).
 * @returns The next review state; a lapse (quality < 3) resets progress.
 */
export const scheduleReview = (input: ScheduleReviewInput): ReviewState => {
  const { previous, quality } = input;

  if (quality < 3) {
    return { repetitions: 0, intervalDays: 1, easeFactor: previous.easeFactor };
  }

  const repetitions = previous.repetitions + 1;
  const easeFactor = nextEaseFactor(previous.easeFactor, quality);

  return {
    repetitions,
    intervalDays: nextInterval(repetitions, previous.intervalDays, easeFactor),
    easeFactor,
  };
};
```

- [ ] **Step 4: Re-export from the barrel**

Change `packages/core/src/index.ts` to:

```ts
export * from "./domain";
export * from "./result";
export * from "./scoring";
export * from "./spaced-repetition";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/core test`
Expected: PASS.

- [ ] **Step 6: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/spaced-repetition.ts packages/core/src/spaced-repetition.test.ts packages/core/src/index.ts
git commit -m "feat(core): add SM-2 lite spaced repetition scheduler"
```

---

## Task 15: XP calculation (TDD)

**Files:**

- Create: `packages/core/src/gamification.ts`
- Test: `packages/core/src/gamification.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `interface XpInput { readonly correctCount: number; readonly questionCount: number }`
  - `calculateXp(input: XpInput): number`
  - Module-private constants `XP_PER_CORRECT = 10`, `PERFECT_LESSON_BONUS = 20`.

XP = `correctCount * 10`, plus a `20` bonus when the lesson is perfect (`questionCount > 0` and `correctCount === questionCount`).

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/gamification.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { calculateXp } from "./gamification";

describe("calculateXp", () => {
  it("awards ten XP per correct answer", () => {
    expect(calculateXp({ correctCount: 6, questionCount: 10 })).toBe(60);
  });

  it("adds a perfect-lesson bonus", () => {
    expect(calculateXp({ correctCount: 10, questionCount: 10 })).toBe(120);
  });

  it("awards no bonus for an empty lesson", () => {
    expect(calculateXp({ correctCount: 0, questionCount: 0 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/core test`
Expected: FAIL — cannot resolve `./gamification`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/gamification.ts`:

```ts
const XP_PER_CORRECT = 10;
const PERFECT_LESSON_BONUS = 20;

/**
 * Inputs for computing the XP earned from a completed lesson.
 */
export interface XpInput {
  readonly correctCount: number;
  readonly questionCount: number;
}

/**
 * Computes XP earned from a lesson, with a bonus for a perfect run.
 * @param input - The correct-answer count and total question count.
 * @returns The total XP earned.
 */
export const calculateXp = (input: XpInput): number => {
  const base = input.correctCount * XP_PER_CORRECT;
  const isPerfect = input.questionCount > 0 && input.correctCount === input.questionCount;

  return base + (isPerfect ? PERFECT_LESSON_BONUS : 0);
};
```

- [ ] **Step 4: Re-export from the barrel**

Change `packages/core/src/index.ts` to:

```ts
export * from "./domain";
export * from "./gamification";
export * from "./result";
export * from "./scoring";
export * from "./spaced-repetition";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/core test`
Expected: PASS.

- [ ] **Step 6: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/gamification.ts packages/core/src/gamification.test.ts packages/core/src/index.ts
git commit -m "feat(core): add lesson XP calculation"
```

---

## Task 16: Streak calculation (TDD)

**Files:**

- Modify: `packages/core/src/gamification.ts`
- Modify: `packages/core/src/gamification.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `interface StreakState { readonly currentStreak: number; readonly longestStreak: number; readonly lastActivityDate: string }`
  - `interface StreakInput { readonly previous: StreakState; readonly activityDate: string }`
  - `updateStreak(input: StreakInput): StreakState`
  - Module-private constant `MS_PER_DAY = 86_400_000` and helper `dayDifference`.

Dates are server-provided ISO `yyyy-mm-dd` strings (anti-cheat: never device clock). Same day → unchanged; exactly next day → streak +1; any other gap → reset to 1. `longestStreak` is the running maximum.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/gamification.test.ts` (add `updateStreak` to the `./gamification` import):

```ts
describe("updateStreak", () => {
  const base = { currentStreak: 4, longestStreak: 9, lastActivityDate: "2026-07-10" };

  it("increments the streak on the very next day", () => {
    const next = updateStreak({ previous: base, activityDate: "2026-07-11" });

    expect(next.currentStreak).toBe(5);
    expect(next.longestStreak).toBe(9);
    expect(next.lastActivityDate).toBe("2026-07-11");
  });

  it("raises the longest streak when the current one overtakes it", () => {
    const nearRecord = { currentStreak: 9, longestStreak: 9, lastActivityDate: "2026-07-10" };

    const next = updateStreak({ previous: nearRecord, activityDate: "2026-07-11" });

    expect(next.currentStreak).toBe(10);
    expect(next.longestStreak).toBe(10);
  });

  it("leaves the streak unchanged for same-day activity", () => {
    const next = updateStreak({ previous: base, activityDate: "2026-07-10" });

    expect(next).toEqual(base);
  });

  it("resets to one after a missed day", () => {
    const next = updateStreak({ previous: base, activityDate: "2026-07-13" });

    expect(next.currentStreak).toBe(1);
    expect(next.longestStreak).toBe(9);
  });
});
```

The `./gamification` import line becomes:

```ts
import { calculateXp, updateStreak } from "./gamification";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/core test`
Expected: FAIL — `updateStreak` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `packages/core/src/gamification.ts`:

```ts
const MS_PER_DAY = 86_400_000;

/**
 * A user's streak state anchored to server-provided activity dates.
 */
export interface StreakState {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly lastActivityDate: string;
}

/**
 * Inputs for advancing a streak with a new activity date.
 */
export interface StreakInput {
  readonly previous: StreakState;
  readonly activityDate: string;
}

/**
 * Computes whole-day distance between two ISO yyyy-mm-dd dates in UTC.
 * @param fromIso - The earlier ISO date.
 * @param toIso - The later ISO date.
 * @returns The number of whole days from the first date to the second.
 */
const dayDifference = (fromIso: string, toIso: string): number => {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);

  return Math.round((to - from) / MS_PER_DAY);
};

/**
 * Advances a streak given a new server-dated activity.
 * @param input - The previous streak state and the new activity date.
 * @returns The updated streak state.
 */
export const updateStreak = (input: StreakInput): StreakState => {
  const { previous, activityDate } = input;
  const gap = dayDifference(previous.lastActivityDate, activityDate);

  if (gap === 0) {
    return previous;
  }

  const currentStreak = gap === 1 ? previous.currentStreak + 1 : 1;

  return {
    currentStreak,
    longestStreak: Math.max(previous.longestStreak, currentStreak),
    lastActivityDate: activityDate,
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sipilian/core test`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/gamification.ts packages/core/src/gamification.test.ts
git commit -m "feat(core): add streak calculation with anti-cheat server dates"
```

---

## Task 17: Final Definition-of-Done gate

**Files:**

- None (verification only).

**Interfaces:**

- Consumes: everything from Tasks 1–16.
- Produces: proof the whole foundation + core meets the §9.6 Definition of Done.

- [ ] **Step 1: Run the full gate suite from a clean state**

Run:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm format:check
```

Expected: all PASS. Vitest reports every `packages/core` test green and coverage ≥ 80% for lines, functions, branches, and statements (the threshold fails the run otherwise).

- [ ] **Step 2: Confirm the branch is clean**

Run: `git status`
Expected: "nothing to commit, working tree clean".

- [ ] **Step 3: Push the branch (if a remote is configured)**

Run: `git push -u origin feat/foundation-and-core`
Expected: branch pushed; open a PR per the finishing-a-development-branch workflow.

---

## Self-Review

**1. Spec coverage (Foundation + core scope):**

- §3 monorepo (pnpm + Turborepo) → Tasks 1, 3.
- §9.1 strict TS, dependency direction → Tasks 2, 5.
- §9.4 size/complexity caps → Task 5 (`max-lines`, `max-lines-per-function`, `max-params`, `max-depth`, `max-nested-callbacks`, `complexity`, `cognitive-complexity`).
- §9.5 SonarJS recommended + per-package overrides → Task 5.
- §9.7 full flat config incl. naming, no-inline-types, JSDoc, import sort → Task 5.
- §9.7.2 padding-line-between-statements → Task 5 (`@stylistic/padding-line-between-statements`).
- §9.8.1 `core` determinism (no current-time/random reads) → Task 5 (`no-restricted-properties`, `no-restricted-globals`, `no-restricted-syntax` Date guard) + AGENTS.md (Task 7).
- §9.8.2 `db` single-connection (`@neondatabase/serverless` only in `client.ts`) → Task 5 (db + `client.ts` blocks) + AGENTS.md (Task 7). _(The db blocks are forward-looking config; `packages/db` itself lands in its own later plan.)_
- §9.8.3–9.8.6 (`auth`, `api`, `apps/web`, `apps/mobile`) → summarized in AGENTS.md (Task 7); full enforcement lands in each module's own future plan.
- §9.6 Definition of Done (test/lint/typecheck/coverage ≥80) → Task 6 thresholds + Tasks 8, 17 gates.
- §3.3 error handling `Result` → Task 9.
- §4 scoring rules (TWK/TIU 5/0, TKP weighted 1–5, passing grade) → Tasks 11–13.
- §5.2 spaced repetition (SM-2 lite) → Task 14.
- §5.1/§5.4 XP + streak (anti-cheat server dates, §10.1) → Tasks 15–16.
- Out of this plan's scope (deferred to later per-subsystem plans): `db`, `auth`, `api`, `apps/web`, `apps/mobile`, monetization. Noted in the parent decomposition.

**2. Placeholder scan:** No `TBD`/`TODO`/"handle edge cases"/"similar to Task N". Every code step shows complete, lint-compliant code including JSDoc and padding lines.

**3. Type consistency:** `SubtestScore`, `ScoringError`, `Result`/`ok`/`err`/`isOk`/`isErr`, `ReviewState`, `StreakState`, `calculateXp`, `updateStreak`, `scheduleReview`, `scoreObjectiveSubtest`, `scoreTkpSubtest`, `scoreTryout` are named identically wherever consumed across tasks. Barrel (`index.ts`) re-exports stay in `simple-import-sort` order (`domain`, `gamification`, `result`, `scoring`, `spaced-repetition`).

**Note on ESLint plugin APIs:** versions are pinned in Task 5 (`eslint-plugin-sonarjs@^3`, `typescript-eslint@^8`, `@stylistic/eslint-plugin@^2`). If an installed major differs, the config's `sonarjs.configs.recommended.rules` spread or `@stylistic/padding-line-between-statements` rule id may need adjustment to that major's API — verify with the `pnpm lint` step before proceeding.
