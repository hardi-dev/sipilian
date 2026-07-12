# Fase 3 — `packages/auth` (Better Auth) — Design Spec

- **Tanggal:** 2026-07-12
- **Status:** Disetujui (siap masuk rencana implementasi)
- **Induk:** [Sipilian SKD App Design](./2026-07-12-sipilian-skd-app-design.md) §9.8.3, §12 Fase 3
- **Ruang lingkup:** Paket autentikasi lintas-klien (admin web + mobile Expo)

---

## 1. Tujuan

Menyediakan **satu paket autentikasi** yang melayani dua klien dengan satu sumber
konfigurasi:

- **Admin web** (TanStack Start) — sesi berbasis **cookie**.
- **Mobile** (Expo) — sesi berbasis **token** di SecureStore via `@better-auth/expo`.

Skema tabel auth (`users`/`sessions`/`accounts`/`verifications`) **sudah ada** di
`packages/db` (Fase 2). Fase 3 menambah konfigurasi server, klien, helper role, dan
**satu kolom `role`** yang belum ada.

## 2. Keputusan Kunci (hasil brainstorming)

| Aspek                | Keputusan                                                                 |
| -------------------- | ------------------------------------------------------------------------- |
| Metode auth          | Email + password; **verifikasi email OFF** untuk MVP                      |
| Role                 | Kolom `role` minimal (default `"user"`); promosi `admin` **manual** (SQL) |
| Adapter DB           | `drizzleAdapter` dengan `usePlural: true` + map skema eksplisit           |
| Session              | Berbasis DB (tabel `sessions`), masa berlaku 7 hari                       |
| Klien                | Subpath export `./client-web` (React/cookie) & `./client-expo` (token)    |
| Env                  | `authEnv` Zod fail-fast (`secret`, `baseUrl`, `trustedOrigins`)           |
| Testing              | Unit (env, roles, smoke) **+ integrasi** signup/signin vs Neon dev        |
| DB test              | Reuse `neondb` dev; test **membersihkan** user yang dibuat                |
| Error di `roles.ts`  | `Result` (tanpa throw), sesuai §9.3                                       |

## 3. Struktur File & Tanggung Jawab

```
packages/auth/
├─ src/
│  ├─ env.ts            # authEnv — Zod fail-fast (BETTER_AUTH_SECRET, BETTER_AUTH_URL, TRUSTED_ORIGINS)
│  ├─ roles.ts          # ROLES + Role + isAdmin() + requireAdmin() (murni, Result)
│  ├─ server.ts         # instance `auth` (Better Auth) — TANPA react/react-native
│  ├─ client-web.ts     # `authClient` admin web (better-auth/react, cookie)
│  ├─ client-expo.ts    # `authClient` mobile (@better-auth/expo, token)
│  ├─ index.ts          # barrel: auth, ROLES, isAdmin, requireAdmin, tipe Session/AuthUser
│  ├─ env.test.ts
│  ├─ roles.test.ts
│  └─ server.test.ts    # smoke + integrasi signup/signin
├─ package.json         # exports: "." + "./client-web" + "./client-expo"
├─ tsconfig.json
└─ vitest.config.ts
```

### Arah dependensi

- `auth` **boleh** impor `@sipilian/db` (adapter butuh instance drizzle + skema) &
  `drizzle-orm`. `auth` berada **di atas** `db`.
- `server.ts` **dilarang** impor `react`/`react-native`.
- `react` hanya di `client-web.ts`; `react-native` hanya di `client-expo.ts` (lewat
  `@better-auth/expo`).
- Semua file `auth` dilarang impor `**/apps/**`.
- Ditegakkan via ESLint `no-restricted-imports` (§9.8.3 induk).

## 4. `server.ts` — Konfigurasi Better Auth

```ts
export const auth = betterAuth({
  secret: authEnv.secret,
  baseURL: authEnv.baseUrl,
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
  session: { expiresIn: 60 * 60 * 24 * 7 },
  trustedOrigins: authEnv.trustedOrigins,
  plugins: [expo()],
});
```

- `usePlural: true` + `schema` map menjembatani tabel jamak & id UUID yang sudah ada.
- `role` dikontrol server (`input: false`) — klien tak bisa menyetel admin sendiri.
- `expo()` (dari `@better-auth/expo`) adalah plugin **sisi server**, tak mengimpor
  `react-native`, jadi `server.ts` tetap bersih.

### Sumber import (akurat vs barrel `db`)

- `db` diimpor dari `@sipilian/db` (barrel `.` mengekspor instance drizzle).
- Tabel `users`/`sessions`/`accounts`/`verifications` diimpor dari
  `@sipilian/db/schema` (barrel `.` **tidak** mengekspor skema — hanya subpath
  `./schema`).

### ⚠️ Risiko teknis: driver `neon-http` tanpa transaksi

`packages/db/src/client.ts` memakai `drizzle-orm/neon-http` (stateless HTTP), yang
**tidak mendukung `db.transaction()`**. Sebagian operasi Better Auth (mis. signup =
create user + create account) berpotensi dibungkus transaksi → bisa gagal saat
runtime.

**Mitigasi (diverifikasi lewat integration test Fase 3):**

1. Integration signup/signin **wajib** dijalankan lebih dulu untuk membuktikan alur
   berjalan di `neon-http`.
2. Bila Better Auth menuntut transaksi, sediakan **instance drizzle khusus auth**
   berbasis WebSocket Pool (`drizzle-orm/neon-serverless` + `Pool`) di dalam
   `packages/auth` (env `DATABASE_URL` yang sama), **tanpa** mengubah `db` bersama.
   Keputusan diambil saat task integrasi, dicatat di plan sebagai cabang bersyarat.

## 5. `env.ts` — `authEnv`

Meniru pola `packages/db/src/env.ts`. Interface `AuthEnv` bernama (bukan inline):

```ts
export interface AuthEnv {
  readonly secret: string;
  readonly baseUrl: string;
  readonly trustedOrigins: readonly string[];
}
```

- `secret`: `z.string().min(32)` (kunci penandatangan sesi).
- `baseUrl`: `z.string().url()`.
- `trustedOrigins`: dari `TRUSTED_ORIGINS` (comma-separated) → `.split(",")` →
  array non-kosong.
- Parse `process.env` sekali saat load; throw bila invalid (fail-fast).

## 6. `roles.ts` — Konstanta & Helper

```ts
export const ROLES = { admin: "admin", user: "user" } as const;

export type Role = "admin" | "user";               // named union (bukan inline)

export interface RoleBearer { readonly role: string; }

export function isAdmin(user: RoleBearer): boolean;                // murni
export function requireAdmin(user: RoleBearer): Result<RoleBearer, AuthError>;
```

- `AuthError` / `AuthErrorCode` mengikuti pola `<Domain>Error` (§9.8.1): kode
  `snake_case` (mis. `not_admin`), pesan Inggris untuk developer.
- `requireAdmin` mengembalikan `Result` (tanpa throw) — dipakai route-guard admin di
  Fase 5. `Result` diimpor dari `@sipilian/core`.

## 7. Tipe Publik (`index.ts`)

- `export { auth }` (server); `export { ROLES, isAdmin, requireAdmin }`.
- `export type Session = typeof auth.$Infer.Session;`
- `export type AuthUser = Session["user"];` (hindari bentrok dgn `UserRow` dari `db`).
- **Klien tidak diekspor dari barrel** — hanya via subpath (`./client-web`,
  `./client-expo`) agar bundel klien tak menyeret server.

## 8. Perubahan di `packages/db` — Kolom `role`

Tambah ke tabel `users`:

```ts
role: text("role").notNull().default("user"),
```

- Literal `"user"` **sengaja diduplikasi** di skema db (db tak boleh impor `auth` —
  arah dependensi). Didokumentasikan sebagai default DB.
- Generate migrasi baru (`0001_*`) via `drizzle-kit generate`, **apply ke Neon** via
  `db:migrate`, tambah test skema untuk kolom `role`.
- `UserRow`/`UserInsertRow` otomatis memuat `role` (infer Drizzle).

## 9. Strategi Pengujian

### Unit (deterministik, tanpa jaringan)

- `env.test.ts`: valid → `authEnv` terisi; `secret` < 32 / `baseUrl` bukan URL /
  `trustedOrigins` kosong → throw.
- `roles.test.ts`: `isAdmin` true/false; `requireAdmin` Ok untuk admin, `Err`
  (`not_admin`) untuk non-admin.

### Smoke config

- `server.test.ts`: `auth` meng-expose `.api` & `.handler` (instansiasi sukses).

### Integrasi (vs Neon dev `neondb`)

- Signup: `auth.api.signUpEmail({ body: { email, password, name } })` dengan email
  unik per-run (mis. `test-<timestamp>-<rand>@example.com`).
- Signin: `auth.api.signInEmail({ body: { email, password } })` → sesi valid.
- Assert `role === "user"` (default) pada user baru.
- **Cleanup wajib**: hapus user yang dibuat (cascade menghapus session/account) di
  `afterEach`/`afterAll`, agar tak meninggalkan sisa di dev.

## 10. Dampak CI

- Job `test` kini memerlukan secret **`DATABASE_URL`** (Neon dev) & **`BETTER_AUTH_SECRET`**
  agar `packages/auth` integrasi jalan.
- Ditambahkan ke `.github/workflows/ci.yml` sebagai `env:` dari
  `secrets.DATABASE_URL` / `secrets.BETTER_AUTH_SECRET`.
- Pengguna menambahkan kedua secret di GitHub repo settings (langkah manual, dicatat
  di plan).
- `.env.example` diperbarui: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`.

## 11. Definition of Done (Fase 3)

Selaras §9.6 induk: **test lulus · lint bersih (SonarJS + batas ukuran) · typecheck
lolos · coverage kode baru ≥ 80%**. Ditambah:

- Migrasi `role` ter-apply ke Neon & terverifikasi (kolom ada).
- Signup/signin integrasi hijau terhadap Neon dev, dengan cleanup bekerja.
- ESLint override paket auth aktif (ban react di `server.ts`, dsb).

## 12. Di Luar Cakupan Fase 3 (roadmap)

- Verifikasi email, reset password via email, social/OAuth login.
- Plugin admin Better Auth (ban/impersonate) — role manual cukup untuk MVP.
- Billing/entitlement enforcement (Fase api/mobile), rate limiting lanjutan.
