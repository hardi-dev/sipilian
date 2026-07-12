# Fase 3 — `packages/auth` (Better Auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `@sipilian/auth` package that configures Better Auth (email+password) for admin web (cookie) and mobile (server-side token flow), with a manual-admin role system, validated by unit + live Neon integration tests.

**Architecture:** One server instance (`auth`) built on Better Auth's Drizzle adapter over the existing plural/UUID auth tables in `@sipilian/db`. Pure, testable units (`env`, `roles`) return typed data / `Result`; the server config is smoke- and integration-tested. A minimal `role` column is added to `users` via a new committed migration.

**Tech Stack:** Better Auth 1.x, `@better-auth/expo` (server plugin), Drizzle ORM, Neon (dev `neondb`), Zod, Vitest.

**Design spec:** [docs/superpowers/specs/2026-07-12-fase3-auth-package-design.md](../specs/2026-07-12-fase3-auth-package-design.md)

**Branch:** `feat/auth-package` (already checked out).

## Global Constraints

- **Runtime:** Node `>=22`; package manager `pnpm@10.14.0`.
- **TypeScript strict** with `verbatimModuleSyntax: true` → use `import type` / inline `type` qualifier for type-only imports.
- **Coding rules (§9):** JSDoc required on every function declaration + named arrow (no `@example`, no types in JSDoc); no inline object types or inline literal unions (extract named `interface`/`type`); files `kebab-case`; `max-lines-per-function` 20; `padding-line-between-statements` (blank after imports, before `return`, around blocks).
- **Errors:** expected errors use `Result` from `@sipilian/core` (`ok`/`err`), never `throw` in `roles.ts`.
- **Auth:** email+password, `requireEmailVerification: false`; `role` server-controlled (`input: false`), DB default `"user"`.
- **Tables:** `snake_case` plural, already present in `@sipilian/db`; adapter uses `usePlural: true` + explicit schema map.
- **DoD (§9.6):** `pnpm lint` + `pnpm typecheck` + `pnpm test` green; coverage of new code ≥ 80%.
- **Dependency direction (§9.8.3):** `auth` may import `@sipilian/db`, `@sipilian/core`, `drizzle-orm`; `server.ts` must not import `react`/`react-native`; no `**/apps/**` imports anywhere in `auth`.

---

## File Structure

```
packages/auth/
├─ package.json          # name @sipilian/auth; exports "." + "./client-web"
├─ tsconfig.json         # extends ../../tsconfig.base.json
├─ vitest.config.ts      # loads root .env for DATABASE_URL/BETTER_AUTH_SECRET; coverage ≥80
└─ src/
   ├─ env.ts             # buildAuthEnv(source) + authEnv
   ├─ roles.ts           # ROLES, Role, RoleBearer, AuthError, isAdmin, requireAdmin
   ├─ server.ts          # `auth` Better Auth instance
   ├─ client-web.ts      # `authClient` (cookie); excluded from coverage
   ├─ index.ts           # barrel + Session/AuthUser types
   ├─ env.test.ts
   ├─ roles.test.ts
   └─ server.test.ts     # smoke + integration signup/signin
```

Modified outside the package: `packages/db/src/schema/auth.ts` (+`role`), a new `packages/db/drizzle/0001_*.sql`, `eslint.config.js` (auth overrides), `.env` (local), `.env.example`, `.github/workflows/ci.yml`.

---

## Task 1: Scaffold package + `env.ts`

**Files:**
- Create: `packages/auth/package.json`, `packages/auth/tsconfig.json`, `packages/auth/vitest.config.ts`
- Create: `packages/auth/src/env.ts`, `packages/auth/src/env.test.ts`
- Modify: `eslint.config.js` (add auth override blocks)
- Modify: `.env` (local, gitignored), `.env.example`

**Interfaces:**
- Produces: `interface AuthEnv { readonly secret: string; readonly baseUrl: string; readonly trustedOrigins: readonly string[] }`; `buildAuthEnv(source: NodeJS.ProcessEnv): AuthEnv`; `authEnv: AuthEnv`.

- [ ] **Step 1: Create `packages/auth/package.json`**

```json
{
  "name": "@sipilian/auth",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./client-web": "./src/client-web.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage"
  },
  "dependencies": {
    "better-auth": "^1.3.0",
    "@better-auth/expo": "^1.3.0",
    "@sipilian/core": "workspace:*",
    "@sipilian/db": "workspace:*",
    "drizzle-orm": "^0.45.2"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^2.1.9",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 2: Create `packages/auth/tsconfig.json`** (mirror `packages/core/tsconfig.json`)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `packages/auth/vitest.config.ts`** — loads the repo-root `.env` so integration tests get real credentials locally, while CI injects them via `process.env`.

```ts
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const fileEnv = loadEnv("test", "../../", "");

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? fileEnv.DATABASE_URL ?? "",
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? fileEnv.BETTER_AUTH_SECRET ?? "",
      BETTER_AUTH_URL:
        process.env.BETTER_AUTH_URL ?? fileEnv.BETTER_AUTH_URL ?? "http://localhost:3000",
      TRUSTED_ORIGINS:
        process.env.TRUSTED_ORIGINS ??
        fileEnv.TRUSTED_ORIGINS ??
        "http://localhost:3000,sipilian://",
    },
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/client-web.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

- [ ] **Step 4: Add auth ESLint overrides to `eslint.config.js`** — insert these two blocks immediately after the `packages/db/src/schema/**/*.ts` block (before the `**/vitest.config.ts` block):

```js
  {
    files: ["packages/auth/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react-native", message: "auth: react-native only in the expo client file." },
          ],
          patterns: ["**/apps/**"],
        },
      ],
    },
  },
  {
    files: ["packages/auth/src/server.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "server.ts must stay UI-free." },
            { name: "react-native", message: "server.ts must stay UI-free." },
          ],
          patterns: ["**/apps/**"],
        },
      ],
    },
  },
```

- [ ] **Step 5: Add local `.env` values** (root `.env`, gitignored). Append two lines (keep the existing `DATABASE_URL`):

```bash
printf 'BETTER_AUTH_SECRET=%s\n' "$(openssl rand -base64 32)" >> .env
printf 'BETTER_AUTH_URL=http://localhost:3000\n' >> .env
printf 'TRUSTED_ORIGINS=http://localhost:3000,sipilian://\n' >> .env
```

- [ ] **Step 6: Update `.env.example`** — overwrite with the full documented set:

```
# Sipilian — example environment. Copy to `.env` and fill in real values.
# `.env` is gitignored; never commit secrets.
DATABASE_URL=postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/sipilian?sslmode=require
BETTER_AUTH_SECRET=generate-with-openssl-rand-base64-32-min-32-chars
BETTER_AUTH_URL=http://localhost:3000
TRUSTED_ORIGINS=http://localhost:3000,sipilian://
```

- [ ] **Step 7: Install dependencies**

Run: `pnpm install`
Expected: adds `@sipilian/auth` to the workspace; lockfile updates; no errors.

- [ ] **Step 8: Write the failing test** — `packages/auth/src/env.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { buildAuthEnv } from "./env";

const validSource = {
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  TRUSTED_ORIGINS: "http://localhost:3000, sipilian://",
};

describe("buildAuthEnv", () => {
  it("parses a valid source and splits trusted origins", () => {
    const env = buildAuthEnv(validSource);

    expect(env.secret).toHaveLength(32);
    expect(env.baseUrl).toBe("http://localhost:3000");
    expect(env.trustedOrigins).toEqual(["http://localhost:3000", "sipilian://"]);
  });

  it("throws when the secret is shorter than 32 chars", () => {
    expect(() => buildAuthEnv({ ...validSource, BETTER_AUTH_SECRET: "short" })).toThrow();
  });

  it("throws when baseUrl is not a URL", () => {
    expect(() => buildAuthEnv({ ...validSource, BETTER_AUTH_URL: "nope" })).toThrow();
  });

  it("throws when trustedOrigins is blank", () => {
    expect(() => buildAuthEnv({ ...validSource, TRUSTED_ORIGINS: "" })).toThrow();
  });
});
```

- [ ] **Step 9: Run test to verify it fails**

Run: `pnpm --filter @sipilian/auth test`
Expected: FAIL — cannot resolve `./env` / `buildAuthEnv` is not exported.

- [ ] **Step 10: Implement `packages/auth/src/env.ts`**

```ts
import { z } from "zod";

/**
 * Shape of the environment consumed by the auth package.
 */
export interface AuthEnv {
  readonly secret: string;
  readonly baseUrl: string;
  readonly trustedOrigins: readonly string[];
}

const authEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  TRUSTED_ORIGINS: z.string().min(1),
});

/**
 * Builds the typed auth environment from a raw env source; throws if invalid.
 * @param source - The raw environment record to validate.
 * @returns The validated, typed auth environment.
 */
export function buildAuthEnv(source: NodeJS.ProcessEnv): AuthEnv {
  const raw = authEnvSchema.parse({
    BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: source.BETTER_AUTH_URL,
    TRUSTED_ORIGINS: source.TRUSTED_ORIGINS,
  });

  return {
    secret: raw.BETTER_AUTH_SECRET,
    baseUrl: raw.BETTER_AUTH_URL,
    trustedOrigins: raw.TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()),
  };
}

export const authEnv: AuthEnv = buildAuthEnv(process.env);
```

> Note: `zod` resolves transitively via `@sipilian/db`'s dep tree in the workspace; if `pnpm --filter @sipilian/auth exec tsc` cannot resolve `zod`, add it explicitly: `pnpm --filter @sipilian/auth add zod@^4.4.3`.

- [ ] **Step 11: Run test to verify it passes**

Run: `pnpm --filter @sipilian/auth test`
Expected: PASS — 4 tests green.

- [ ] **Step 12: Verify lint + typecheck**

Run: `pnpm lint && pnpm --filter @sipilian/auth typecheck`
Expected: both exit 0.

- [ ] **Step 13: Commit**

```bash
git add packages/auth eslint.config.js .env.example pnpm-lock.yaml package.json
git commit -m "feat(auth): scaffold @sipilian/auth package with validated env"
```

---

## Task 2: `roles.ts` — role constants + guards

**Files:**
- Create: `packages/auth/src/roles.ts`, `packages/auth/src/roles.test.ts`

**Interfaces:**
- Consumes: `Result`, `ok`, `err` from `@sipilian/core`.
- Produces: `ROLES = { admin: "admin", user: "user" }`; `type Role = "admin" | "user"`; `interface RoleBearer { readonly role: string }`; `type AuthErrorCode = "not_admin"`; `interface AuthError { readonly code: AuthErrorCode; readonly message: string }`; `isAdmin(user: RoleBearer): boolean`; `requireAdmin(user: RoleBearer): Result<RoleBearer, AuthError>`.

- [ ] **Step 1: Write the failing test** — `packages/auth/src/roles.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { isAdmin, requireAdmin, ROLES } from "./roles";

describe("isAdmin", () => {
  it("is true for an admin role", () => {
    expect(isAdmin({ role: ROLES.admin })).toBe(true);
  });

  it("is false for a user role", () => {
    expect(isAdmin({ role: ROLES.user })).toBe(false);
  });
});

describe("requireAdmin", () => {
  it("returns Ok for an admin", () => {
    const result = requireAdmin({ role: ROLES.admin });

    expect(result.ok).toBe(true);
  });

  it("returns Err(not_admin) for a non-admin", () => {
    const result = requireAdmin({ role: ROLES.user });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("not_admin");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/auth test roles`
Expected: FAIL — cannot resolve `./roles`.

- [ ] **Step 3: Implement `packages/auth/src/roles.ts`**

```ts
import { type Result, err, ok } from "@sipilian/core";

/**
 * Canonical role identifiers stored on the user row.
 */
export const ROLES = { admin: "admin", user: "user" } as const;

export type Role = "admin" | "user";

/**
 * Minimal shape needed to evaluate a user's role.
 */
export interface RoleBearer {
  readonly role: string;
}

export type AuthErrorCode = "not_admin";

/**
 * Expected, non-throwing error returned by role guards.
 */
export interface AuthError {
  readonly code: AuthErrorCode;
  readonly message: string;
}

/**
 * Reports whether the given user holds the admin role.
 * @param user - The role-bearing user to check.
 * @returns True when the user's role equals the admin role.
 */
export function isAdmin(user: RoleBearer): boolean {
  return user.role === ROLES.admin;
}

/**
 * Requires the user to be an admin, returning a Result instead of throwing.
 * @param user - The role-bearing user to guard.
 * @returns Ok with the user when admin, otherwise Err with an AuthError.
 */
export function requireAdmin(user: RoleBearer): Result<RoleBearer, AuthError> {
  if (!isAdmin(user)) {
    return err({ code: "not_admin", message: "User must have the admin role." });
  }

  return ok(user);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipilian/auth test roles`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Verify lint + typecheck**

Run: `pnpm lint && pnpm --filter @sipilian/auth typecheck`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/roles.ts packages/auth/src/roles.test.ts
git commit -m "feat(auth): add ROLES constants and isAdmin/requireAdmin guards"
```

---

## Task 3: Add `role` column to `users` (db migration)

**Files:**
- Modify: `packages/db/src/schema/auth.ts` (add `role` column to `users`)
- Modify: `packages/db/src/schema/auth.test.ts` (assert the column)
- Create: `packages/db/drizzle/0001_*.sql` (generated) + `packages/db/drizzle/meta/*` (generated)

**Interfaces:**
- Produces: `users.role` column, `notNull`, default `"user"`; `UserRow.role: string` (inferred).

- [ ] **Step 1: Write the failing test** — append to `packages/db/src/schema/auth.test.ts`

```ts
it("gives users a role column defaulting to user", () => {
  expect(users.role.name).toBe("role");
  expect(users.role.notNull).toBe(true);
  expect(users.role.default).toBe("user");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/db test auth`
Expected: FAIL — `users.role` is undefined.

- [ ] **Step 3: Add the column** — in `packages/db/src/schema/auth.ts`, inside the `users` `pgTable`, add `role` immediately after the `image` line:

```ts
  image: text("image"),
  role: text("role").notNull().default("user"),
```

> The `"user"` default literal is intentionally duplicated here (db must not import `auth` — wrong dependency direction). It mirrors `ROLES.user` in `packages/auth/src/roles.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipilian/db test auth`
Expected: PASS — the new assertion passes.

- [ ] **Step 5: Generate the migration**

Run: `cd packages/db && DATABASE_URL="$(grep -E '^DATABASE_URL=' ../../.env | cut -d= -f2-)" pnpm db:generate`
Expected: creates `drizzle/0001_<name>.sql` containing `ALTER TABLE "users" ADD COLUMN "role" text NOT NULL DEFAULT 'user';` and updates `drizzle/meta/`.

- [ ] **Step 6: Apply the migration to Neon**

Run: `cd packages/db && DATABASE_URL="$(grep -E '^DATABASE_URL=' ../../.env | cut -d= -f2-)" pnpm db:migrate`
Expected: `migrations applied successfully!`

- [ ] **Step 7: Verify the column exists in Neon**

Run (from `packages/db`):
```bash
DATABASE_URL="$(grep -E '^DATABASE_URL=' ../../.env | cut -d= -f2-)" node --input-type=module -e '
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const r = await sql`select column_name, column_default from information_schema.columns where table_name=${"users"} and column_name=${"role"}`;
console.log(r);
'
```
Expected: one row, `column_default` contains `'user'`.

- [ ] **Step 8: Verify db suite + lint**

Run: `pnpm --filter @sipilian/db test && pnpm lint`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add packages/db/src/schema/auth.ts packages/db/src/schema/auth.test.ts packages/db/drizzle
git commit -m "feat(db): add role column to users with default user"
```

---

## Task 4: `server.ts` — Better Auth instance + smoke test

**Files:**
- Create: `packages/auth/src/server.ts`, `packages/auth/src/server.test.ts`

**Interfaces:**
- Consumes: `authEnv` from `./env`; `db` from `@sipilian/db`; `users`, `sessions`, `accounts`, `verifications` from `@sipilian/db/schema`; `betterAuth`, `drizzleAdapter`, `expo`.
- Produces: `auth` — the Better Auth server instance (exposes `auth.handler`, `auth.api`, `auth.$Infer`).

- [ ] **Step 1: Write the failing test** — `packages/auth/src/server.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { auth } from "./server";

describe("auth server instance", () => {
  it("exposes the Better Auth handler and api", () => {
    expect(typeof auth.handler).toBe("function");
    expect(auth.api).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipilian/auth test server`
Expected: FAIL — cannot resolve `./server`.

- [ ] **Step 3: Implement `packages/auth/src/server.ts`**

```ts
import { expo } from "@better-auth/expo";
import { db } from "@sipilian/db";
import { accounts, sessions, users, verifications } from "@sipilian/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { authEnv } from "./env";

const sevenDaysInSeconds = 60 * 60 * 24 * 7;

/**
 * Configured Better Auth server instance shared by web and mobile clients.
 */
export const auth = betterAuth({
  secret: authEnv.secret,
  baseURL: authEnv.baseUrl,
  trustedOrigins: [...authEnv.trustedOrigins],
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: { user: users, session: sessions, account: accounts, verification: verifications },
  }),
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "user", input: false },
    },
  },
  session: { expiresIn: sevenDaysInSeconds },
  plugins: [expo()],
});
```

> If `tsc` reports a type error from `@better-auth/expo` or `better-auth` internals referencing `react-native`/Expo types, it is suppressed by `skipLibCheck: true` (already set in `tsconfig.base.json`). Our code imports no RN types, so `server.ts` stays clean.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipilian/auth test server`
Expected: PASS — instance constructs (no DB connection made at import).

- [ ] **Step 5: Verify lint + typecheck** (confirms `server.ts` react/react-native ban holds)

Run: `pnpm lint && pnpm --filter @sipilian/auth typecheck`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/server.ts packages/auth/src/server.test.ts
git commit -m "feat(auth): configure Better Auth server with drizzle adapter and role field"
```

---

## Task 5: Integration test — signup/signin against Neon (+ neon-http fallback)

**Files:**
- Modify: `packages/auth/src/server.test.ts` (add integration block)
- Conditional: `packages/auth/src/server.ts` (Pool fallback, only if the transaction error appears)

**Interfaces:**
- Consumes: `auth.api.signUpEmail`, `auth.api.signInEmail`; `db` + `users` + `eq` for cleanup.

- [ ] **Step 1: Add the integration test** — append to `packages/auth/src/server.test.ts`

```ts
import { eq } from "drizzle-orm";
import { afterEach } from "vitest";

import { db } from "@sipilian/db";
import { users } from "@sipilian/db/schema";

const createdEmails: string[] = [];

/**
 * Generates a unique test email so repeated runs never collide.
 * @returns A unique example.com email address.
 */
function uniqueEmail(): string {
  return `test-${Date.now().toString()}-${Math.random().toString(36).slice(2)}@example.com`;
}

afterEach(async () => {
  for (const email of createdEmails.splice(0)) {
    await db.delete(users).where(eq(users.email, email));
  }
});

describe("email auth integration (Neon dev)", () => {
  it("signs up then signs in a new user defaulting to the user role", async () => {
    const email = uniqueEmail();
    const password = "Passw0rd!test";

    createdEmails.push(email);

    const signUp = await auth.api.signUpEmail({
      body: { email, password, name: "Integration Test User" },
    });

    expect(signUp.user.email).toBe(email);

    const signIn = await auth.api.signInEmail({ body: { email, password } });

    expect(signIn.token).toBeTruthy();

    const [row] = await db.select().from(users).where(eq(users.email, email));

    expect(row?.role).toBe("user");
  });
});
```

> Move the three new `import` lines to the top of the file with the existing imports (import-sort will otherwise fail). Keep `describe`/`it`/`expect` from the existing `vitest` import and add `afterEach` to it.

- [ ] **Step 2: Run the integration test**

Run: `pnpm --filter @sipilian/auth test server`
Expected: PASS — user is created, signed in, `role === "user"`, then deleted in `afterEach`.

**If instead it FAILS with an error whose message contains `No transactions support in neon-http driver` (or `transaction`), apply Steps 3–5 (the Pool fallback). Otherwise skip to Step 6.**

- [ ] **Step 3 (fallback): Add Neon WebSocket Pool deps**

Run: `pnpm --filter @sipilian/auth add @neondatabase/serverless@^1.1.0`
(`drizzle-orm` is already a dependency.)

- [ ] **Step 4 (fallback): Give the adapter its own transactional instance** — in `packages/auth/src/server.ts`, replace the `db` import and the `drizzleAdapter(db, …)` argument:

```ts
import { Pool } from "@neondatabase/serverless";
import { accounts, sessions, users, verifications } from "@sipilian/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/neon-serverless";

import { expo } from "@better-auth/expo";

import { authEnv } from "./env";

const sevenDaysInSeconds = 60 * 60 * 24 * 7;

// Node >=22 provides a global WebSocket, so neon-serverless needs no ws shim.
const authPool = new Pool({ connectionString: process.env.DATABASE_URL });

const authDb = drizzle(authPool, {
  schema: { users, sessions, accounts, verifications },
});
```

Then change the adapter call to `drizzleAdapter(authDb, { … })` (keep the same options object). Re-run import-sort with `pnpm lint --fix` if the import order changed.

- [ ] **Step 5 (fallback): Re-run the integration test**

Run: `pnpm --filter @sipilian/auth test server`
Expected: PASS.

- [ ] **Step 6: Full package suite + coverage gate**

Run: `pnpm --filter @sipilian/auth test`
Expected: all tests PASS; coverage ≥ 80% on `env.ts`, `roles.ts`, `server.ts`.

- [ ] **Step 7: Verify lint + typecheck**

Run: `pnpm lint && pnpm --filter @sipilian/auth typecheck`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/auth/src/server.ts packages/auth/src/server.test.ts package.json pnpm-lock.yaml
git commit -m "test(auth): add live signup/signin integration against Neon dev"
```

---

## Task 6: `client-web.ts` + `index.ts` barrel

**Files:**
- Create: `packages/auth/src/client-web.ts`, `packages/auth/src/index.ts`

**Interfaces:**
- Produces (subpath `@sipilian/auth/client-web`): `authClient` (cookie-session web client).
- Produces (barrel `@sipilian/auth`): `auth`, `authEnv`, `ROLES`, `isAdmin`, `requireAdmin`, types `AuthError`, `AuthErrorCode`, `Role`, `RoleBearer`, `Session`, `AuthUser`.

- [ ] **Step 1: Implement `packages/auth/src/client-web.ts`** (framework-agnostic client; `apps/web` can layer React hooks in Fase 5)

```ts
import { createAuthClient } from "better-auth/client";

import { authEnv } from "./env";

/**
 * Auth client for the admin web app; browser cookie session is the default.
 */
export const authClient = createAuthClient({ baseURL: authEnv.baseUrl });
```

- [ ] **Step 2: Implement `packages/auth/src/index.ts`**

```ts
import { auth } from "./server";

export { authEnv } from "./env";
export { isAdmin, requireAdmin, ROLES } from "./roles";
export type { AuthError, AuthErrorCode, Role, RoleBearer } from "./roles";
export { auth };

export type Session = typeof auth.$Infer.Session;

export type AuthUser = Session["user"];
```

- [ ] **Step 3: Verify typecheck** (confirms `Session`/`AuthUser` inference resolves and subpath exports type-check)

Run: `pnpm --filter @sipilian/auth typecheck`
Expected: exit 0.

- [ ] **Step 4: Verify lint + full test suite**

Run: `pnpm lint && pnpm --filter @sipilian/auth test`
Expected: green; coverage still ≥ 80% (`index.ts` and `client-web.ts` are excluded from coverage).

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/client-web.ts packages/auth/src/index.ts
git commit -m "feat(auth): add web auth client and package barrel exports"
```

---

## Task 7: CI secrets wiring + finalize

**Files:**
- Modify: `.github/workflows/ci.yml` (inject secrets into the `test` job)

**Interfaces:** none (infra).

- [ ] **Step 1: Add env to the `test` job** — in `.github/workflows/ci.yml`, under `test:` add a job-level `env` block right after `runs-on: ubuntu-latest`:

```yaml
  test:
    runs-on: ubuntu-latest

    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
```

- [ ] **Step 2: Validate the workflow YAML parses**

Run: `node --input-type=module -e 'import("node:fs").then(async (fs)=>{const y=await import("yaml").catch(()=>null); const t=fs.readFileSync(".github/workflows/ci.yml","utf8"); if(y){y.parse(t);} console.log("yaml ok, length", t.length);})'`
Expected: prints `yaml ok, length …` with no throw. (If the `yaml` module is absent it still prints the length — a plain read check.)

- [ ] **Step 3: Run the full root gate locally**

Run: `pnpm lint && pnpm typecheck && pnpm format:check && pnpm test`
Expected: all green (the root `pnpm test` runs auth integration using the local `.env`).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: provide DATABASE_URL and BETTER_AUTH_SECRET to the test job"
```

- [ ] **Step 5: MANUAL — add GitHub Actions secrets** (cannot be automated here)

In GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**, add:
- `DATABASE_URL` = the Neon dev connection string.
- `BETTER_AUTH_SECRET` = a 32+ char secret (`openssl rand -base64 32`).

Without these, the CI `test` job's auth integration test will fail.

---

## Self-Review

**1. Spec coverage** (design spec §-by-§):
- §3/§4 server config → Task 4. §5 env → Task 1. §6 roles + Result → Task 2. §7 barrel/types → Task 6. §8 role column migration → Task 3. §9 testing (unit+integration) → Tasks 1,2,4,5. §10 CI secrets + .env.example → Tasks 1,7. §11 DoD → gates in every task. §12 client-expo deferred → not built here (documented). ✅ All covered.

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; the conditional fallback (Task 5) is fully coded, not a placeholder. ✅

**3. Type consistency:** `AuthEnv`/`buildAuthEnv`/`authEnv` (Task 1) used unchanged in Tasks 4/6. `ROLES`/`RoleBearer`/`AuthError`/`isAdmin`/`requireAdmin` (Task 2) match barrel exports (Task 6). `auth` produced in Task 4 consumed by Tasks 5/6; `auth.$Infer.Session` → `Session` → `AuthUser` consistent. `users.role` (Task 3) consumed by Task 5 assertion. ✅

**4. Known external-API caveat:** Better Auth 1.x `api.signUpEmail`/`signInEmail` body shapes and `$Infer.Session` are assumed per 1.x docs; if the installed version differs, adjust call sites — the integration test will surface any mismatch immediately.
