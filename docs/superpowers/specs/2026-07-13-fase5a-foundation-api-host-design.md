# Fase 5a — `apps/web` Fondasi & API Host — Design Spec

- **Tanggal:** 2026-07-13
- **Status:** Draf (menunggu review pengguna)
- **Induk:** [Fase 5 Highlight](./2026-07-13-fase5-web-app-highlight.md) · [Sipilian SKD App Design](./2026-07-12-sipilian-skd-app-design.md) §9.8.5, §12 Fase 5
- **Ruang lingkup:** Irisan fondasi Fase 5 — scaffold `apps/web`, host Better Auth,
  login + guard admin, seed admin, host `createServerFn` + resolusi sesi→`ctx`,
  **satu handler (`getLearningPath`) terbukti end-to-end**, lint `apps/web`.

---

## 1. Tujuan

Membuktikan **seluruh tulang punggung** `apps/web` dengan satu irisan vertikal
tertipis: seorang admin (yang di-seed) login, membuka halaman terproteksi, dan
halaman itu memanggil `getLearningPath` **melalui host `createServerFn`** yang
me-resolve `ctx.userId` dari sesi — lalu merender data live. Sisa handler & UI
authoring dibangun di sub-fase berikutnya (5b–5e) di atas fondasi ini.

Bukan tujuan 5a: UI authoring apa pun, membungkus handler selain `getLearningPath`,
UI signup, manajemen user.

## 2. Keputusan Kunci

Keputusan lintas-fase (UI stack, login-only, seed via Better Auth API, batas `db`,
lint) diwarisi dari **Highlight §2** dan tidak diulang. Keputusan spesifik 5a:

| Aspek                    | Keputusan                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Framework host           | TanStack Start (`@tanstack/react-start` + `@tanstack/react-router`), file-based routing          |
| Transpile paket workspace | `vite.config.ts` → `ssr.noExternal: [/^@sipilian\//]` (paket source-only TS)                     |
| Mount auth               | Route catch-all `routes/api/auth/$.ts` → `auth.handler(request)`                                  |
| Resolusi sesi            | `auth.api.getSession({ headers })` sisi server; keputusan otorisasi diekstrak ke fungsi **murni** |
| Otorisasi                | `resolveAuthorization(session \| null)` → `Result<AuthedIdentity, AuthzError>` (pakai `isAdmin`)  |
| Guard route              | Layout `_admin` via `beforeLoad` memanggil server fn; `Err` → `redirect({ to: "/login" })`       |
| Host handler             | `createServerFn` + `authMiddleware`; membungkus `getLearningPath` saja di 5a                      |
| Login                    | Form shadcn kustom → `authClient.signIn.email` (dari `@sipilian/auth/client-web`)                 |
| Seed admin               | Skrip Node: `auth.api.signUpEmail` (env `ADMIN_EMAIL`/`ADMIN_PASSWORD`) → `db` set `role='admin'` |
| Clock `ctx.now`          | `new Date()` nyata di `buildRequestContext` (sisi server; `core` tetap terima waktu via `ctx`)     |
| Testing                  | Unit: `resolveAuthorization` (murni). Integrasi: skrip seed vs Neon dev (idempoten + cleanup)     |

## 3. Struktur File 5a

Subset dari struktur feature-based (Highlight §5); hanya berkas yang dibuat 5a:

```
apps/web/
├─ src/
│  ├─ routes/
│  │  ├─ __root.tsx                 # root layout + <html>, muat globals.css
│  │  ├─ index.tsx                  # redirect → /admin
│  │  ├─ login.tsx                  # render features/auth LoginForm (publik)
│  │  ├─ api/auth/$.ts              # catch-all → auth.handler
│  │  └─ _admin/
│  │     ├─ route.tsx               # beforeLoad guard (requireAdmin server fn)
│  │     └─ index.tsx               # dashboard: pakai hook getLearningPath
│  ├─ features/auth/
│  │  ├─ components/login-form.tsx  # form shadcn
│  │  ├─ hooks/use-sign-in.ts       # TanStack Query mutation → authClient
│  │  └─ server/require-admin.fn.ts # server fn guard (pakai authMiddleware)
│  ├─ features/content/            # (feature "content" mulai di 5b; di 5a hanya proof)
│  │  ├─ hooks/use-learning-path.ts # TanStack Query → getLearningPathFn
│  │  └─ server/get-learning-path.fn.ts
│  ├─ server/
│  │  ├─ session.ts                 # PURE resolveAuthorization()  ← di-unit-test
│  │  ├─ auth-middleware.ts         # createMiddleware: getSession → ctx
│  │  └─ request-context.ts         # buildRequestContext(userId) → RequestContext
│  ├─ components/ui/                # primitif shadcn (button, input, form, card…)
│  ├─ lib/{auth-client.ts, utils.ts}
│  └─ styles/globals.css            # Tailwind v4
├─ scripts/seed-admin.ts            # seed admin (jalur Better Auth API)
├─ src/server/session.test.ts       # unit test resolveAuthorization
├─ scripts/seed-admin.test.ts       # integrasi seed vs Neon dev
├─ vite.config.ts · tsconfig.json · vitest.config.ts · package.json
```

> Catatan: `features/content` di 5a **hanya** memuat proof `getLearningPath`.
> Authoring hierarki konten (feature `content` sesungguhnya) dibangun di 5b.

### Arah dependensi (ditegakkan lint)

- `apps/web` **boleh** impor `@sipilian/api`, `@sipilian/auth`,
  `@sipilian/auth/client-web`, `@sipilian/core`.
- `apps/web` **dilarang** impor `@sipilian/db` **kecuali** dua titik infra yang
  memang butuh instance `db`: `src/server/request-context.ts` dan
  `scripts/seed-admin.ts`. (Lihat §9 untuk perlakuan lint.)
- Komponen di `features/*/components` hanya impor `features/*/hooks` — tak pernah
  `features/*/server` langsung.

## 4. Scaffold & Transpile Paket Source-Only

TanStack Start memakai Vite. Karena semua paket `@sipilian/*` mengekspor `.ts`
mentah (tanpa build step), Vite harus mentranspilenya alih-alih memperlakukannya
sebagai dependensi eksternal:

```ts
// vite.config.ts (inti)
export default defineConfig({
  ssr: { noExternal: [/^@sipilian\//] },
  plugins: [ /* tanstackStart(), react(), tailwind() */ ],
});
```

Tanpa `noExternal`, SSR akan `import` `.ts` mentah dari `node_modules` (symlink
workspace) dan gagal. Versi persis TanStack Start / plugin dipatok di **plan**.

## 5. Mount Better Auth

`routes/api/auth/$.ts` — route API catch-all meneruskan ke handler fetch bawaan
Better Auth:

```ts
// GET & POST → auth.handler(request)
```

Ini menyalakan seluruh endpoint auth (`/api/auth/sign-in/email`,
`/api/auth/get-session`, dst). `authClient` (`@sipilian/auth/client-web`) memanggil
endpoint ini. `BETTER_AUTH_URL` = origin `apps/web`.

## 6. Resolusi Sesi, Otorisasi, & Guard (inti 5a)

**Logika otorisasi diekstrak menjadi fungsi murni** agar bisa di-unit-test tanpa
router/HTTP:

```ts
// src/server/session.ts (PURE)
type AuthedIdentity = { readonly userId: string };
type AuthzErrorCode = "unauthenticated" | "forbidden";
// resolveAuthorization(session | null):
//   null                      → Err("unauthenticated")
//   session & !isAdmin(role)  → Err("forbidden")
//   session & isAdmin(role)   → Ok({ userId: session.user.id })
```

- Memakai `isAdmin` dari `@sipilian/auth` dan `Result` dari `@sipilian/core`.
- **`auth-middleware.ts`**: `createMiddleware().server(...)` membaca `Request`
  (`getWebRequest()`), panggil `auth.api.getSession({ headers })`, jalankan
  `resolveAuthorization`. `Err` → lempar `redirect`/respons status; `Ok` →
  `next({ context: { userId } })`.
- **`request-context.ts`**: `buildRequestContext(userId)` →
  `{ userId, db, now: new Date() }` (tipe `RequestContext` dari `@sipilian/api`).
- **Guard route**: `_admin/route.tsx` `beforeLoad` memanggil server fn tipis
  (`requireAdmin.fn.ts`, memakai `authMiddleware`); bila middleware melempar
  unauthenticated/forbidden → `redirect({ to: "/login" })`.

## 7. Host API: `createServerFn` + Bukti End-to-End

Pola host (dipakai ulang tiap sub-fase):

1. **Server fn** (`features/content/server/get-learning-path.fn.ts`):
   `createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(getLearningPathInputSchema).handler(async ({ data, context }) => { ... })`
   — bangun `ctx = buildRequestContext(context.userId)`, panggil
   `getLearningPath(data, ctx)`, map `Result`: `Ok` → kembalikan payload; `Err` →
   `toHttp(err)` lalu lempar respons ber-status (ditangkap boundary).
2. **Hook** (`features/content/hooks/use-learning-path.ts`): `useQuery` TanStack
   Query memanggil server fn. **Komponen hanya menyentuh hook.**
3. **Dashboard** (`_admin/index.tsx`): render hasil hook (loading/empty/data).

Ini membuktikan rantai: login → cookie sesi → server fn → `getSession` →
`resolveAuthorization` → `ctx.userId` → handler Fase 4 → data live di UI.

## 8. Login & Seed Admin

- **Login** (`features/auth`): `LoginForm` (shadcn `Form`+`Input`+`Button`) →
  `useSignIn` (mutation) → `authClient.signIn.email({ email, password })`; sukses →
  `navigate({ to: "/admin" })`. Tak ada UI signup.
- **Seed** (`scripts/seed-admin.ts`): baca `ADMIN_EMAIL`/`ADMIN_PASSWORD` dari env;
  jika email sudah ada → no-op (idempoten); else `auth.api.signUpEmail(...)` lalu
  `db.update(users).set({ role: "admin" })` untuk baris itu. Dijalankan via
  `pnpm --filter @sipilian/web seed:admin`.

## 9. Env & Lint

**Env** (`.env.example` diperbarui): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
(=origin web), `TRUSTED_ORIGINS`, `DATABASE_URL` (sudah ada), **baru**:
`ADMIN_EMAIL`, `ADMIN_PASSWORD`. Auth/`db` memvalidasi env-nya sendiri saat modul
dimuat (pola Fase 3/4).

**Lint** (`eslint.config.js`, blok `apps/web`):
- Aktifkan `eslint-plugin-react`, `eslint-plugin-react-hooks`,
  `eslint-plugin-jsx-a11y` untuk `apps/web/**/*.{ts,tsx}`.
- `no-restricted-imports`: larang `@sipilian/db` di `apps/web/**` **dengan
  pengecualian** file `apps/web/src/server/request-context.ts` dan
  `apps/web/scripts/seed-admin.ts` (blok override yang mengizinkan `db`).
- Caps ukuran/kompleksitas & JSDoc yang ada tetap berlaku (komponen React
  didekomposisi agar ≤20 baris/fungsi).

## 10. Testing

- **Unit** — `src/server/session.test.ts`: `resolveAuthorization` untuk tiga kasus
  (null → unauthenticated; non-admin → forbidden; admin → Ok userId). Murni, tanpa
  I/O. Ini "core" 5a.
- **Integrasi** — `scripts/seed-admin.test.ts` vs Neon dev: jalankan seed, assert
  baris admin `role='admin'` ada; jalankan ulang → no-op; **cleanup** user yang
  dibuat. Pola env-loading & cleanup sama Fase 3/4.
- **Glue tipis** (route, middleware, server fn, komponen) **tak** di-unit-test di
  5a — bergantung pada test handler Fase 4 + unit resolver + integrasi seed.
  Coverage kode baru ≥ 80% (`AGENTS.md`) dipenuhi oleh dua test di atas plus
  ekstraksi logika ke unit murni.
- CI: job `test` yang ada (root `turbo run test`) otomatis mencakup `apps/web`
  (glob workspace). Secret `DATABASE_URL`/`BETTER_AUTH_SECRET` sudah tersedia.

## 11. Definition of Done (5a)

- `pnpm --filter @sipilian/web dev` menyala; `/login` render; login admin (seed)
  berhasil; `/admin` terproteksi (redirect ke `/login` bila tak login/non-admin).
- `/admin` merender hasil `getLearningPath` lewat `createServerFn` end-to-end.
- Skrip seed idempoten membuat admin `role='admin'`.
- `resolveAuthorization` ter-unit-test; seed ter-integrasi-test vs Neon.
- `pnpm lint` (react/hooks/jsx-a11y + larangan `db`), `pnpm typecheck`,
  `pnpm test` **hijau**; coverage kode baru ≥ 80%.

## 12. Di Luar Cakupan 5a (sub-fase lain)

- Membungkus handler selain `getLearningPath` → sub-fase yang membutuhkannya.
- UI authoring (hierarki, soal, tryout, CSV, entitlement) → 5b–5e.
- Component/interaction test & E2E browser → ditinjau saat feature UI muncul (5b+).
- UI signup, reset password, manajemen user → di luar MVP admin.
