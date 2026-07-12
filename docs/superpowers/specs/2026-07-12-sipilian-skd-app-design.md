# Sipilian — Aplikasi Persiapan SKD/CPNS (Design Spec)

- **Tanggal:** 2026-07-12
- **Status:** Disetujui (siap masuk tahap rencana implementasi)
- **Ruang lingkup dokumen:** MVP "walking skeleton" untuk segmen **CPNS / SKD**

---

## 1. Ringkasan & Tujuan

Sipilian adalah aplikasi mobile bergaya Duolingo untuk warga Indonesia yang
mempersiapkan seleksi berbasis CAT. **Segmen MVP dibatasi ke CPNS / SKD**
(Seleksi Kompetensi Dasar: TWK, TIU, TKP). Segmen lain (TNI/Polri, BUMN, dll.)
masuk roadmap, bukan MVP.

Tujuan proyek: **produk serius untuk diluncurkan** — fondasi dirancang agar bisa
tumbuh, namun eksekusi dimulai dari MVP yang fokus.

### Pengalaman inti
Kombinasi **jalur belajar bite-sized** (ala Duolingo) + **simulasi tryout CAT**.

### Strategi build: Walking Skeleton (irisan vertikal tipis)
Bangun seluruh rantai teknologi sejak awal (mobile ↔ API ↔ DB ↔ admin ↔ auth ↔
monetisasi) dengan konten yang cukup untuk menghidupkan **ketiga subtes SKD
(TWK/TIU/TKP) end-to-end**. Setelah kerangka tervalidasi, perbanyak volume konten
("scale by content"), lalu tambah segmen baru.

**Definisi selesai MVP:** SKD lengkap (TWK/TIU/TKP) berjalan end-to-end dengan
semua sistem tersambung dan tervalidasi.

---

## 2. Keputusan Kunci (ringkas)

| Aspek | Keputusan |
|---|---|
| Tujuan | Produk serius untuk diluncurkan |
| Segmen MVP | CPNS / SKD (TWK, TIU, TKP) |
| Inti produk | Jalur belajar bite-sized + tryout CAT |
| Mobile | React Native (Expo) |
| Admin & API | TanStack Start |
| Database | Neon (serverless Postgres) |
| ORM | Drizzle |
| Auth | Better Auth (mobile via `@better-auth/expo`, admin via cookie session) |
| Sumber konten | Kurasi/tulis sendiri, model kisi-kisi resmi BKN, + import CSV |
| Monetisasi | Freemium + Iklan + Premium |
| Lint/Format | ESLint (flat config) + Prettier |
| Aturan kualitas | SonarJS via `eslint-plugin-sonarjs` (bukan platform Sonar) |
| Styling mobile | NativeWind (Tailwind) |
| Error handling | `Result` di `core`, diterjemahkan ke HTTP di batas API |
| State mobile | TanStack Query (server-state) + Zustand (UI lokal) |
| Testing | Vitest, colocated, TDD untuk `packages/core` |

---

## 3. Arsitektur & Struktur Repo

**Monorepo TypeScript** (pnpm workspaces + Turborepo) agar tipe & skema di-share
antara mobile, admin, dan API.

```
sipilian/
├─ apps/
│  ├─ mobile/          # Expo React Native — app pengguna (feature-based)
│  └─ web/             # TanStack Start — panel admin + host API/server functions
├─ packages/
│  ├─ db/              # Drizzle schema + migrasi (Neon) — sumber kebenaran skema
│  ├─ api/             # Definisi RPC server functions + validasi Zod (dipakai web & mobile)
│  ├─ auth/            # Konfigurasi Better Auth (server) + client util
│  └─ core/            # Logika domain murni: CAT scoring, spaced-repetition, XP,
│                      # tipe domain, Result. TANPA I/O (bebas DB/UI/framework).
└─ docs/
```

### Alur data
- **Mobile (Expo)** memanggil **RPC server functions** yang di-host TanStack Start
  → **Drizzle** → **Neon Postgres**.
- **Better Auth** menangani sesi dua klien: mobile (token di SecureStore) & admin
  web (cookie session).
- **`packages/core`** menampung aturan bisnis kritikal sebagai **fungsi murni tanpa
  I/O** — unit paling penting & paling mudah diuji, terisolasi dari DB/jaringan.
- **Admin web** menulis konten → tabel yang sama → langsung terbaca app
  (**update konten tanpa rilis ulang app**).

### Prinsip pemisahan (dependency direction)
- `core` tidak boleh impor `db`/`api`/`apps/**`/`react`/`react-native`.
- `api` boleh pakai `core` + `db`; menangani HTTP tapi mendelegasikan aturan ke `core`.
- `db` hanya skema & query (boleh pakai `core` untuk tipe, tidak boleh UI/apps).
- Diawasi lewat aturan ESLint `no-restricted-imports` (lihat §9).

---

## 4. Model Data

Better Auth otomatis membuat tabel `user`, `session`, `account`, `verification`.
Berikut tabel domain (nama tabel `snake_case` jamak).

### A. Konten (dikelola admin)
- `subtests` — TWK, TIU, TKP. Metadata: nama, bobot, passing grade (ambang batas).
- `topics` — sub-materi dalam subtes (mis. TWK→"Nasionalisme"; TIU→"Silogisme").
  FK `subtest_id`.
- `units` — kumpulan lesson bertahap dalam satu topik (jalur belajar). Punya `order`.
- `lessons` — unit belajar bite-sized (5–10 soal). FK `unit_id`, punya `order`.
- `questions` — batang soal. FK `topic_id`, `difficulty`, `explanation`
  (pembahasan), `status` (draft/published), `type` (pilihan ganda).
- `question_options` — opsi jawaban. `is_correct` (TWK/TIU) atau `weight` 1–5 (TKP).
- `lesson_questions` — relasi soal ↔ lesson.

### B. Tryout CAT
- `tryout_packages` — paket ujian (mis. "Tryout SKD #1"), durasi, komposisi
  (35 TWK / 30 TIU / 45 TKP = 110 soal), tanda free/premium.
- `tryout_package_questions` — soal penyusun paket + urutan.
- `tryout_attempts` — sesi pengerjaan user: `user_id`, waktu mulai/selesai,
  skor per subtes, lulus/tidak.
- `tryout_answers` — jawaban per soal dalam attempt (untuk pembahasan & analitik).

### C. Progres belajar & gamifikasi
- `lesson_completions` — lesson yang sudah diselesaikan user + skornya.
- `user_question_states` — spaced repetition: per (user, soal) simpan review
  terakhir, jadwal review berikutnya, tingkat penguasaan.
- `user_stats` — XP total, streak berjalan, streak terpanjang, tanggal aktivitas
  terakhir.
- `daily_activity` — catatan aktivitas harian (kalender streak & anti-cheat streak).

### D. Monetisasi
- `entitlements` — status Premium user (`user_id`, `plan`, `expires_at`). Untuk MVP
  di-set manual/dev; integrasi billing (Google Play / App Store) menyusul, model
  sudah siap.

### Aturan skoring penting
- **TWK/TIU:** benar = 5, salah = 0.
- **TKP:** berbobot **1–5** (tercermin di `question_options.weight`), tidak ada
  jawaban "salah".
- **Passing grade per subtes** disimpan di `subtests` dan diperiksa saat skoring.

---

## 5. Mekanik Inti & Alur Pengguna

Seluruh logika hidup di `packages/core` (fungsi murni, teruji ketat via TDD).

### 5.1 Loop belajar harian (jalur bite-sized)
- Home = **jalur belajar** per subtes (peta unit → lesson ala Duolingo); lesson
  terkunci sampai prasyarat beres.
- 1 lesson = 5–10 soal, feedback benar/salah + pembahasan tiap soal.
- Selesai lesson → dapat **XP**, progres tersimpan, streak harian ter-update.
- **Nyawa/hearts:** pengguna gratis punya nyawa terbatas (mis. 5); jawaban salah
  mengurangi nyawa, isi ulang seiring waktu atau menonton **rewarded ad**. Premium
  = nyawa tak terbatas. (Titik freemium/iklan pertama.)

### 5.2 Spaced repetition (retensi)
- Setelah soal dikerjakan, `core` menghitung jadwal review berikutnya (algoritma
  ringan ala SM-2 disederhanakan), disimpan di `user_question_states`.
- Sesi **"Latihan/Review"** mengumpulkan soal yang jatuh tempo — pendorong retensi
  jangka panjang (cocok untuk hafalan TWK).

### 5.3 Loop tryout CAT
- Pilih paket → **ujian bertimer** (durasi & komposisi sesuai aturan SKD: 110 soal).
- Skoring `core`: TWK/TIU benar=5/salah=0; **TKP berbobot 1–5**; bandingkan dengan
  passing grade per subtes → lulus/tidak.
- Hasil: skor per subtes, lulus/tidak, dan pembahasan per soal (pembahasan lengkap =
  fitur Premium; gratis dapat sebagian).

### 5.4 Gamifikasi
XP, streak (harian + terpanjang), kalender aktivitas. **Liga/leaderboard & fitur
sosial DILUAR MVP** (roadmap).

### 5.5 Titik monetisasi MVP
- **Iklan (gratis):** interstitial setelah sejumlah lesson + rewarded ad untuk isi
  ulang nyawa.
- **Premium:** nyawa tak terbatas, semua paket tryout, pembahasan lengkap, tanpa
  iklan.

---

## 6. Panel Admin (TanStack Start)

- **Auth admin** (Better Auth, role `admin`) — hanya admin bisa masuk.
- **Manajemen soal:** buat/edit soal + opsi + pembahasan, set `difficulty`, tag ke
  topik, atur `weight` untuk TKP, status draft → published.
- **Struktur konten:** kelola subtes → topik → unit → lesson, atur urutan, pilih
  soal ke lesson.
- **Paket tryout:** susun paket (komposisi 35/30/45), tandai free/premium, publish.
- **Import CSV:** unggah massal soal (kolom: pertanyaan, opsi A–E, kunci/bobot,
  pembahasan, topik, difficulty) dengan validasi & preview sebelum commit.
- **Entitlement:** set Premium manual untuk user (testing) sebelum billing asli.

**Diluar admin MVP:** analitik canggih, moderasi kontributor, A/B testing.

---

## 7. Sumber Konten & Legal

- **Tulis/kurasi soal sendiri** (orisinal), dimodelkan pada **kisi-kisi resmi BKN**
  (struktur TWK/TIU/TKP bersifat publik → soal orisinal yang mengikuti pola resmi
  aman secara hukum).
- **Hindari menyalin verbatim** dari bank soal berhak cipta.
- **Import CSV** untuk menyemai bank soal awal dengan cepat.
- Membuka jalur **kontributor** (dengan moderasi/approval) = pasca-MVP.

---

## 8. Batas Lingkup MVP

### Masuk MVP
- Auth (daftar/masuk) mobile + admin — Better Auth.
- Jalur belajar **TWK, TIU, TKP** (ketiganya): unit & lesson, feedback +
  pembahasan, XP, streak, nyawa.
- Spaced repetition (sesi review).
- Tryout CAT dengan skoring benar (termasuk TKP berbobot & passing grade).
- Freemium: batas nyawa + iklan (rewarded & interstitial), status Premium via
  `entitlements` (di-set manual).
- Admin: authoring soal, struktur konten, paket tryout, import CSV, set entitlement.
- Sinkronisasi progres ke server + ketahanan offline dasar.

### Diluar MVP (roadmap)
- Liga/leaderboard, teman/sosial.
- Segmen lain (TNI/Polri, BUMN).
- Billing asli Google Play / App Store (model data sudah siap).
- Notifikasi push (pengingat streak) — kandidat fast-follow.
- Moderasi kontributor, analitik lanjutan.
- Offline penuh (unduh paket).

---

## 9. Coding Rules & Standar Kualitas

### 9.1 Prinsip umum
- **TypeScript `strict: true`** di semua paket; hindari `any` (pakai `unknown` +
  narrowing).
- **Arah dependensi dipaksakan** (lihat §3) via `no-restricted-imports`.
- **Satu sumber kebenaran tipe:** skema Drizzle → infer tipe DB; **Zod** untuk
  validasi input di batas API, di-share mobile ↔ web.
- **Tidak ada logika bisnis di komponen UI** — UI memanggil hooks/services; aturan
  domain di `core`.
- **Env** via `.env` + validasi Zod fail-fast saat startup.
- **Struktur `apps/mobile`:** feature-based
  (`features/<nama>/{components,hooks,api,screens}` + `shared/` lintas-fitur).
- **API:** RPC-style server functions (fungsi bertipe, dipanggil langsung dari
  client dengan tipe ter-infer).
- **JSDoc wajib** pada fungsi (deklarasi & named arrow) sesuai kaidah, **tanpa
  `@example`** dan tanpa tipe di JSDoc (tipe dari TS).
- **No inline types:** setiap struktur tipe (objek & literal union pada anotasi)
  harus diberi nama (interface/type).
- **Commit:** Conventional Commits; kerja di branch, tidak langsung ke `main`.

### 9.2 Penamaan
- File `kebab-case`; komponen React `PascalCase`; variabel/fungsi `camelCase`;
  konstanta `UPPER_CASE`; tabel DB `snake_case` jamak.
- Key `snake_case` **hanya** lewat objek literal (Zod `z.object({...})`) & tipe
  infer Drizzle. Interface/type tulisan tangan tetap `camelCase`
  (`typeProperty` **tidak** dilonggarkan).

### 9.3 Error handling
- `packages/core` mengembalikan **`Result<Ok | Err>`** untuk error yang diharapkan
  (tanpa throw).
- Batas API menerjemahkan `Err` ke respons HTTP; error tak terduga (bug) dilempar &
  ditangkap handler terpusat.

### 9.4 Batas ukuran & kompleksitas (berlaku `.ts` DAN `.tsx`, tanpa kecuali)
| Aturan | Nilai |
|---|---|
| `max-lines` (file) | 300 (skip blank & comment) |
| `max-lines-per-function` | **20** (skip blank & comment; termasuk komponen React) |
| `max-params` | 4 (lebih → objek opsi) |
| `max-depth` | 3 |
| `max-nested-callbacks` | 3 |
| `complexity` (cyclomatic) | 10 |
| `sonarjs/cognitive-complexity` | 10 |

> Konsekuensi sadar: komponen React akan **didekomposisi agresif** jadi
> sub-komponen kecil agar patuh batas 20 baris/fungsi.

### 9.5 SonarJS (via `eslint-plugin-sonarjs`, bukan platform Sonar)
- Aktifkan `sonarjs.configs.recommended` level **error** (blocking di CI).
- `sonarjs/cognitive-complexity`: **10**.
- `sonarjs/no-duplicate-string`: **threshold 3** (default), **dimatikan** di
  `packages/db/src/schema/**` (skema wajar mengulang literal seperti `"cascade"`)
  dan di file test.
- Di file test (`*.test.ts`): longgarkan `max-lines`, `max-lines-per-function`,
  `sonarjs/no-duplicate-string`, `jsdoc/require-jsdoc`,
  `@typescript-eslint/no-non-null-assertion`.

### 9.6 Definition of Done (per task)
Semua harus hijau: **test lulus** · **lint bersih (termasuk SonarJS & batas
ukuran)** · **typecheck lolos** · **coverage kode baru ≥ 80%**. Gate ini
**blocking** di CI sejak commit pertama.

### 9.7 ESLint flat config (acuan)
Config final (mengintegrasikan seluruh keputusan di atas). Catatan penyesuaian dari
draft awal: `files` mencakup `**/*.tsx`, dan paket domain murni memakai
`packages/core` (bukan `shared`).

#### 9.7.1 Penjelasan setiap rule (versi final)

**Blok global**

| Item | Nilai | Arti |
|---|---|---|
| `ignores` | `dist`, `drizzle`, `.turbo`, `node_modules` | Folder ini tidak di-lint sama sekali |
| `js.configs.recommended` | — | Aturan dasar ESLint untuk JS berlaku di semua file |
| `prettier` (paling akhir) | — | Mematikan aturan ESLint yang bentrok dengan format Prettier |

**Blok utama — `files: ["**/*.ts", "**/*.tsx"]`** (berlaku ke `.ts` DAN `.tsx`)

Setup:

| Item | Arti |
|---|---|
| `extends: strictTypeChecked` | Aturan TS paling ketat + berbasis analisis tipe |
| `extends: stylisticTypeChecked` | Aturan gaya penulisan TS berbasis tipe |
| `plugins` | Mengaktifkan `@stylistic`, `simple-import-sort`, `jsdoc`, `sonarjs` |
| `projectService: true` | Memakai TypeScript project service untuk aturan type-aware |

Aturan inti:

| Rule | Setelan | Arti |
|---|---|---|
| `sonarjs/*` (recommended) | error | Seluruh preset SonarJS aktif sebagai error |
| `sonarjs/cognitive-complexity` | `10` | Fungsi dengan kompleksitas kognitif > 10 ditolak |
| `simple-import-sort/imports` | error | Urutan `import` wajib rapi (auto-fix) |
| `simple-import-sort/exports` | error | Urutan `export` wajib rapi (auto-fix) |
| `no-restricted-syntax` #1 | error | Larang tipe objek inline — `x: { a: number }` harus jadi `interface`/`type` bernama |
| `no-restricted-syntax` #2 | error | Larang union literal inline pada anotasi — `x: "a" \| "b"` harus jadi `type` bernama |

Naming convention (`@typescript-eslint/naming-convention`):

| Target | Format wajib |
|---|---|
| `default` | `camelCase` |
| `variable` | `camelCase` atau `UPPER_CASE` |
| `parameter` | `camelCase` (boleh diawali `_`) |
| `typeLike` (type/interface/class/enum) | `PascalCase` |
| `enumMember` | `PascalCase` atau `UPPER_CASE` |
| `variable` const + exported | `camelCase`, `PascalCase`, atau `UPPER_CASE` |
| `objectLiteralProperty` | bebas (null) — supaya key `snake_case` payload API/DB boleh |
| `import` | `camelCase` atau `PascalCase` |

> Catatan: `typeProperty` sengaja **tidak** dilonggarkan → interface/type tulisan
> tangan tetap `camelCase`; `snake_case` hanya lewat objek literal (Zod) & tipe
> infer Drizzle.

Batas ukuran & kompleksitas:

| Rule | Setelan | Arti |
|---|---|---|
| `max-lines` | `300`, skip kosong & komentar | Maks 300 baris kode per file |
| `max-lines-per-function` | `20`, skip kosong/komentar, `IIFEs: true` | Maks 20 baris per fungsi (termasuk komponen React, tanpa kecuali) |
| `max-params` | `4` | Lebih dari 4 argumen → pakai objek opsi |
| `max-depth` | `3` | Maks 3 tingkat nesting blok |
| `max-nested-callbacks` | `3` | Maks 3 callback bersarang |
| `complexity` | `10` | Cyclomatic complexity maks 10 (pelengkap cognitive) |

JSDoc:

| Rule | Setelan | Arti |
|---|---|---|
| `jsdoc/require-jsdoc` | FunctionDeclaration, MethodDefinition, named arrow; `publicOnly: false` | JSDoc wajib di semua fungsi/metode/named arrow (bukan hanya publik) |
| `jsdoc/no-types` | error | Dilarang menulis tipe di dalam JSDoc (tipe dari TS) |
| `jsdoc/check-alignment` | error | Perataan blok `/** */` harus rapi |
| `jsdoc/check-param-names` | error | Nama `@param` harus cocok parameter asli |
| `jsdoc/check-tag-names` (`typed: true`) | error | Hanya tag valid; mode TS |
| `jsdoc/require-description` | error | Wajib ada deskripsi |
| `jsdoc/require-param` | error | Wajib `@param` untuk tiap parameter |
| `jsdoc/require-param-description` | error | Tiap `@param` wajib deskripsi |
| `jsdoc/require-returns` | error | Wajib `@returns` |
| `jsdoc/require-returns-description` | error | `@returns` wajib deskripsi |
| `jsdoc/require-param-type` | off | Tidak wajib tipe di `@param` (karena TS) |
| `jsdoc/require-returns-type` | off | Tidak wajib tipe di `@returns` (karena TS) |

**Blok override per-paket**

| Blok (`files`) | Aturan | Arti |
|---|---|---|
| `packages/core/**/*.ts` | `no-restricted-imports` | `core` harus murni: dilarang impor `@sipilian/db`, `drizzle-orm`, `@neondatabase/serverless` (bebas DB), `react`, `react-native` (bebas UI), dan `**/apps/**` |
| `packages/db/**/*.ts` | `no-restricted-imports` | `db` layer data: dilarang impor `react`, `react-native`, dan `**/apps/**` (boleh pakai `core`) |
| `packages/db/src/schema/**/*.ts` | `sonarjs/no-duplicate-string: off` | Skema Drizzle wajar mengulang literal (mis. `"cascade"`) |
| `**/*.test.ts`, `**/vitest.config.ts` | beberapa off | Dilonggarkan: `no-non-null-assertion`, `require-jsdoc`, `max-lines`, `max-lines-per-function`, `sonarjs/no-duplicate-string` |

#### 9.7.2 Aturan spasi wajib — `padding-line-between-statements` (PENTING)

Berbeda dari Prettier (yang mengatur format), rule ini mengatur **spasi semantik
antar-statement** dan ditegakkan sebagai **error (blocking di CI)**. Semua
auto-fixable via `eslint --fix`.

Ketentuan:
- Baris kosong **sesudah** blok `import`, sesudah direktif, dan sesudah deklarasi
  `const/let/var` — kecuali antar-item sejenis berdampingan (import↔import,
  deklarasi↔deklarasi) boleh rapat.
- Baris kosong **sebelum** `return`.
- Baris kosong **sebelum & sesudah** blok `if/for/while/switch/try/function/class`.

Contoh:

```ts
// ❌ MELANGGAR
import { z } from "zod";
const schema = z.object({ id: z.string() });
function scoreTwk(correct: number) {
  const point = correct * 5;
  return point;
}

// ✅ SESUAI
import { z } from "zod";

const schema = z.object({ id: z.string() });

function scoreTwk(correct: number) {
  const point = correct * 5;

  return point;
}
```

> Aturan-aturan di §9 akan dituangkan juga ke `AGENTS.md` repo agar konsisten
> dipatuhi oleh manusia maupun agen.

### 9.8 Aturan spesifik per-modul

Melengkapi aturan global (§9.1–9.7), tiap modul punya aturan tambahan pada tiga
dimensi: **struktur & pola**, **penamaan & API**, dan **override ESLint**. Kolom
"Penegakan" membedakan **lint** (machine-checked, blocking di CI) vs **konvensi**
(didokumentasikan di `AGENTS.md`, ditegakkan lewat review).

#### 9.8.1 `packages/core`

- **Struktur & pola:** hanya fungsi murni (tanpa class untuk logika domain);
  **deterministik** — `Date`, `Math.random`, timer **tidak boleh** dipakai di dalam
  fungsi domain, waktu & keacakan **di-inject** sebagai parameter (mis. `updateStreak`
  menerima `activityDate` dari server); satu tanggung jawab per file; `Result`
  dikembalikan untuk error yang diharapkan — **tidak pernah `throw`** (throw hanya
  untuk bug/invariant).
- **Penamaan & API:** tipe error `<Domain>Error` + `<Domain>ErrorCode` (kode berupa
  literal `snake_case`, pesan bahasa Inggris untuk developer); fungsi berupa verba
  (`score*`, `calculate*`, `schedule*`, `update*`); interface input `<Fn>Input`,
  hasil `<Noun>Score`/`<Noun>State`; **semua ekspor lewat `index.ts`** (barrel),
  impor dalam (`@sipilian/core/src/...`) dilarang.
- **Override ESLint:** pertahankan ban kemurnian `no-restricted-imports`
  (`@sipilian/db`, `drizzle-orm`, `@neondatabase/serverless`, `react`,
  `react-native`, `**/apps/**`); **tambah** `no-restricted-globals` untuk `Date`,
  `Math.random`, `setTimeout`, `setInterval` di `packages/core/src/**` (kecuali
  `*.test.ts`). **Penegakan: lint.**

#### 9.8.2 `packages/db`

- **Struktur & pola:** skema dipecah **per area domain** (`content.ts`, `tryout.ts`,
  `progress.ts`, `monetization.ts`); **hanya `src/client.ts`** yang membuat koneksi
  Neon/Drizzle — file lain memakai instance `db` bersama; query helper mengembalikan
  data polos (tanpa HTTP/Zod/aturan bisnis); migrasi digenerate `drizzle-kit`,
  di-commit ke `drizzle/`, **tidak diedit tangan**; tabel Better Auth tetap
  didefinisikan di sini (satu sumber skema).
- **Penamaan & API:** tabel `snake_case` **jamak**, kolom `snake_case`; tiap tabel
  mengekspor tipe `typeof t.$inferSelect`/`$inferInsert` sebagai **sumber kebenaran
  bentuk baris** (tanpa interface baris tulisan tangan); FK `<referenced_singular>_id`.
- **Override ESLint:** pertahankan ban `react`/`react-native`/`**/apps/**` dan
  `sonarjs/no-duplicate-string: off` di `src/schema/**`; **tambah** aturan agar
  `@neondatabase/serverless` **hanya** boleh diimpor dari `src/client.ts`.
  **Penegakan: lint.**

#### 9.8.3 `packages/auth`

- **Struktur & pola:** `src/server.ts` (instance & konfigurasi Better Auth server);
  klien via **subpath export** — `@sipilian/auth/client-web` (cookie session) &
  `@sipilian/auth/client-expo` (`@better-auth/expo`); `src/roles.ts` menampung
  konstanta peran (`"admin"`, `"user"`); skema tabel auth tetap tinggal di
  `packages/db`.
- **Penamaan & API:** ekspor `auth` (server) & `authClient` (klien); tipe sesi
  `Session`, user `AuthUser` (hindari bentrok dengan tipe baris `User` dari `db`);
  env divalidasi Zod fail-fast lewat objek `authEnv`.
- **Override ESLint:** `no-restricted-imports` melarang `**/apps/**`; file server
  (`server.ts`) juga melarang `react`/`react-native`; `react-native` hanya sah di
  file klien expo. **Penegakan: lint.**

#### 9.8.4 `packages/api`

- **Struktur & pola:** server functions dikelompokkan per fitur (`lessons`,
  `tryouts`, `progress`, `content`, `entitlements`) dengan **`*.schema.ts` &
  `*.handler.ts` berdampingan**; handler **tipis** (parse → delegasi ke `core`/`db`
  → map `Err` ke HTTP), **tanpa logika domain**; satu `src/http.ts` memetakan kode
  error domain → status+body.
- **Penamaan & API:** fungsi berupa verba per fitur (`submitLesson`, `startTryout`,
  `submitTryout`, `syncProgress`, `setEntitlement`); skema `<action>InputSchema`/
  `<action>OutputSchema`, tipe infer `<Action>Input`/`<Action>Output`; mutasi
  non-idempoten membawa `idempotencyKey` di skema input.
- **Override ESLint:** `no-restricted-imports` melarang `**/apps/**` &
  `react`/`react-native` (boleh `core`/`db`/`auth`). **Penegakan: lint.**
- **Konvensi (AGENTS.md):** di `*.handler.ts` dilarang `throw` untuk error yang
  diharapkan — kembalikan error HTTP hasil map dari `Result` (bug tak terduga tetap
  naik ke handler terpusat). **Penegakan: konvensi.**

#### 9.8.5 `apps/web` (admin + host API)

- **Struktur & pola:** `app/routes/**` (layar admin), `app/server/**` (wiring tipis
  server functions dari `api`, tanpa logika domain), `app/features/<area>/{components,
  hooks}` (mirror pembagian fitur `api`), `app/shared/**`; **route-guard peran
  `admin` di layout** (bukan per-halaman); import CSV divalidasi & di-commit di sisi
  server.
- **Penamaan & API:** file `kebab-case`, identifier komponen `PascalCase`; hook
  `use*` membungkus TanStack Query — **komponen tidak memanggil server function
  langsung**, selalu lewat hook.
- **Override ESLint:** aktifkan `eslint-plugin-react` + `react-hooks` +
  `jsx-a11y` khusus `apps/web/**`; `no-restricted-imports` melarang impor
  `packages/db` langsung (harus lewat `api`). **Penegakan: lint.**

#### 9.8.6 `apps/mobile` (Expo)

- **Struktur & pola:** `src/features/<name>/{components,hooks,api,screens}` (`learn`,
  `review`, `tryout`, `profile`, `paywall`) + `src/shared/**`; **state split** —
  server-state via **TanStack Query**, UI lokal via **Zustand**; buffer jawaban
  offline tinggal di `features/<x>/api` (bukan komponen).
- **Penamaan & API:** file `kebab-case`, komponen `PascalCase`, hook `use*`, store
  `use<Name>Store`, layar `<Name>Screen`; styling via **NativeWind `className`**;
  query keys tersentralisasi per fitur.
- **Override ESLint:** aktifkan `eslint-plugin-react` + `react-hooks` +
  `eslint-plugin-react-native` khusus `apps/mobile/**`; `no-restricted-imports`
  melarang `packages/db`; **larang named import `StyleSheet` dari `react-native`**
  (NativeWind-only). **Penegakan: lint.**
- **Konvensi (AGENTS.md):** data server tidak pernah masuk Zustand; **tanpa logika
  bisnis di store** (skoring/XP dari `core` via `api`). **Penegakan: konvensi.**

---

## 10. Penanganan Error, Offline & Pengujian

### 10.1 Error & kasus tepi
- **Timer tryout** = sumber kebenaran di server (waktu mulai tersimpan); jika app
  tertutup/ganti jaringan, sisa waktu dihitung ulang dari server — anti-curang &
  tahan gangguan.
- **Putus koneksi saat lesson/tryout:** jawaban di-buffer lokal, di-sync saat
  online; **submit tryout idempoten** (tidak dobel).
- **Konsistensi skor:** skoring dihitung di server (`core`), bukan dipercayakan ke
  klien.
- **Validasi input** end-to-end pakai Zod (skema dibagikan mobile ↔ API).
- **Streak anti-cheat:** aktivitas divalidasi terhadap tanggal server
  (`daily_activity`), bukan jam perangkat.

### 10.2 Offline dasar (MVP)
Lesson berjalan & progres tahan putus koneksi; konten di-cache ringan. Offline penuh
(unduh paket) = pasca-MVP.

### 10.3 Strategi pengujian
- **Unit test `packages/core` (TDD wajib):** skoring CAT (termasuk bobot TKP &
  passing grade), algoritma spaced-repetition, kalkulasi XP/streak. Area paling
  rawan, diuji paling ketat, terisolasi tanpa DB/jaringan.
- **Integration test `packages/api`:** endpoint kunci (submit lesson, mulai/submit
  tryout, sync progres) terhadap Neon test branch.
- **Test tipis di admin & mobile** untuk alur kritis (import CSV, submit tryout).

---

## 11. Roadmap Pasca-MVP (ringkas)
1. Perbanyak volume soal SKD & analitik pengguna.
2. Notifikasi push (pengingat streak) — kandidat fast-follow.
3. Liga/leaderboard & fitur sosial.
4. Billing asli (Google Play / App Store) menggantikan entitlement manual.
5. Segmen baru: TNI/Polri, lalu BUMN.
6. Jalur kontributor soal + moderasi; offline penuh.
