# Fase 5 — `apps/web` (Admin + API Host) — Highlight Spec

- **Tanggal:** 2026-07-13
- **Status:** Disetujui (peta jalan; tiap sub-fase punya design spec sendiri)
- **Induk:** [Sipilian SKD App Design](./2026-07-12-sipilian-skd-app-design.md) §9.8.5, §12 Fase 5
- **Ruang lingkup:** Dekomposisi Fase 5 menjadi sub-fase vertikal (5a–5e). Dokumen
  ini menetapkan tujuan fase, keputusan lintas-sub-fase, dan urutan build. Detail
  tiap sub-fase ditulis di design spec masing-masing.

---

## 1. Tujuan Fase

Menghidupkan **host web pertama** untuk aplikasi. Dua tujuan yang saling terkait:

1. **Host API walking-skeleton.** `apps/web` membungkus handler Fase 4
   (`@sipilian/api`) sebagai TanStack Start `createServerFn`, dan me-resolve
   **sesi → `ctx.userId`** (batas yang sengaja ditunda di Fase 4).
2. **Authoring konten admin.** UI admin untuk membangun konten ketiga subtes
   (TWK/TIU/TKP) end-to-end: hierarki konten, soal, paket tryout, import CSV.

**Selesai fase (§12):** admin bisa membuat konten ketiga subtes end-to-end, dan
batas API walking-skeleton bisa dipanggil lewat host web.

## 2. Keputusan Lintas Sub-Fase (berlaku 5a–5e)

| Aspek                | Keputusan                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Framework            | **TanStack Start** (React, SSR, `createServerFn`) — sesuai spek induk                          |
| UI stack             | **Tailwind CSS v4 + shadcn/ui** (komponen di-copy ke repo; a11y bawaan Radix)                  |
| Akses admin          | **Login-only, admin di-seed** (tanpa UI signup di `apps/web`)                                  |
| Seed admin           | Skrip panggil **Better Auth API** (`signUpEmail`) lalu **promote `role='admin'`** via `db`     |
| Batas data           | UI admin **dilarang impor `packages/db`** — selalu lewat `@sipilian/api`                        |
| Boundary komponen    | Komponen **tak memanggil server function langsung** — lewat hook (`react`/TanStack Query)       |
| Resolusi sesi        | `auth.api.getSession({ headers })` → `ctx.userId` **dan** cek `isAdmin(role)` (satu resolver)   |
| Lint front-end       | `react` + `react-hooks` + `jsx-a11y` aktif untuk `apps/web`; larangan impor `db` via lint       |
| Env                  | `apps/web` menyetel `BETTER_AUTH_URL` + `TRUSTED_ORIGINS` ke origin-nya sendiri; `DATABASE_URL` |

Keputusan-keputusan ini **tidak** diulang-brainstorm di tiap sub-fase; sub-fase
hanya menambah keputusan spesifiknya.

## 3. Kendala Teknis yang Sudah Dipetakan

- **Paket workspace = source-only.** Setiap paket mengekspor `./src/index.ts`
  langsung (tanpa build step), `moduleResolution: "Bundler"`. Vite/TanStack Start
  di `apps/web` **wajib mentranspile TS workspace** saat runtime/bundle.
- **Auth siap di-host.** `auth.handler` (fetch handler) memasang endpoint;
  `auth.api.getSession({ headers })` me-resolve sesi sisi server. Tak perlu ubah
  `packages/auth`.
- **Kontrak lint `apps/web` sudah disepakati** di `AGENTS.md` (§ Module-specific):
  tak impor `db`, komponen tak panggil server fn langsung, `react`/`react-hooks`/
  `jsx-a11y` aktif. Fase 5 mengimplementasikan kontrak yang sudah ada.
- **`neon-http` tanpa transaksi.** Sudah terbukti cukup untuk signup Better Auth di
  Fase 3; seed admin memakai jalur API yang sama.

## 4. Dekomposisi Sub-Fase (fondasi → akhir)

Tiap sub-fase adalah **irisan vertikal** dengan design spec + plan + PR sendiri.

### 5a — Fondasi & API Host

Scaffold TanStack Start + Tailwind/shadcn; mount Better Auth handler; halaman
**login** + route-guard sesi→`isAdmin`; skrip seed admin; host `createServerFn` +
resolver sesi→`ctx.userId`; **satu handler (`getLearningPath`) dibuktikan
end-to-end**; konfigurasi lint `apps/web`.
**Selesai:** admin login → halaman terproteksi memanggil `getLearningPath` lewat
host dan merender data live.
**Bergantung:** Fase 3, Fase 4.

### 5b — Hierarki Konten

Authoring subtes → topik → unit → lesson (dengan urutan) + memilih soal ke lesson.
**Bergantung:** 5a.

### 5c — Authoring Soal

Soal + opsi + pembahasan + `difficulty` + siklus status draft→published.
**Bergantung:** 5a (dan 5b untuk penautan lesson↔soal).

### 5d — Paket Tryout

Komposisi paket (35/30/45), free/premium, publish.
**Bergantung:** 5c.

### 5e — Import CSV + Entitlement

Import CSV: validasi + preview + commit di server; set entitlement manual (testing).
**Bergantung:** 5c, 5d.

**Catatan urutan:** 5b dan 5c berpasangan erat (lesson menautkan soal). Saat
brainstorm 5b/5c akan diputuskan apakah digabung atau mana yang lebih dulu. 5a
membuka blokir semua sub-fase lain.

## 5. Definition of Done (Fase, ringkas)

- Kelima sub-fase (5a–5e) selesai; tiap PR: test lulus · lint bersih · typecheck
  lulus · coverage kode baru ≥ 80% (per `AGENTS.md`).
- Admin bisa authoring konten TWK/TIU/TKP end-to-end (§12 "Selesai fase").
- Batas API walking-skeleton dapat dipanggil via host web (`createServerFn`).

## 6. Di Luar Cakupan Fase 5 (fase lain)

- **`apps/mobile` (Expo)** — Fase 6.
- **Pengalaman pengguna akhir** (learn/review/tryout runtime) — Fase 6; `apps/web`
  hanya sisi admin/authoring + host API.
- **Validasi walking skeleton end-to-end MVP** — Fase 7.
