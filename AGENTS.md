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
