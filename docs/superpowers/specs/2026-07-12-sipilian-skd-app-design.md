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

```js
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
    rules: {
      // SonarJS recommended preset + stricter cognitive complexity.
      ...sonarjs.configs.recommended.rules,
      "sonarjs/cognitive-complexity": ["error", 10],

      // Import ordering (auto-fixable).
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // No inline types — every type structure must be named.
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSTypeAnnotation TSTypeLiteral",
          message: "Inline object types are not allowed. Extract to a named interface or type.",
        },
        {
          selector: "TSTypeAnnotation > TSUnionType:has(TSLiteralType)",
          message: "Inline literal unions are not allowed. Extract to a named type.",
        },
      ],

      // Naming conventions.
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
        // API/DB payloads use snake_case keys, so do not constrain object keys.
        { selector: "objectLiteralProperty", format: null },
        { selector: "import", format: ["camelCase", "PascalCase"] },
      ],

      // Max length (blank lines and comments are not counted).
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": [
        "error",
        { max: 20, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      "max-params": ["error", 4],
      "max-depth": ["error", 3],
      "max-nested-callbacks": ["error", 3],
      complexity: ["error", 10],

      // JSDoc required on all declared functions & named arrows; types come from TS.
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

      // Semantic spacing (auto-fixable) — does not conflict with Prettier.
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "directive", next: "*" },
        { blankLine: "any", prev: "directive", next: "directive" },
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "any", prev: "import", next: "import" },
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        { blankLine: "any", prev: ["const", "let", "var"], next: ["const", "let", "var"] },
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
    // core must stay framework-free and pure — no DB, no UI runtime.
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@sipilian/db", message: "core must not depend on the db layer" },
            { name: "drizzle-orm", message: "core must stay framework/DB-free" },
            { name: "@neondatabase/serverless", message: "core must stay framework/DB-free" },
            { name: "react", message: "core must stay UI-free" },
            { name: "react-native", message: "core must stay UI-free" },
          ],
          patterns: ["**/apps/**"],
        },
      ],
    },
  },
  {
    // db is a data layer — it may use core, but never the app/UI layer.
    files: ["packages/db/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "react" }, { name: "react-native" }], patterns: ["**/apps/**"] },
      ],
    },
  },
  {
    // Drizzle schemas legitimately repeat string literals (e.g. "cascade").
    files: ["packages/db/src/schema/**/*.ts"],
    rules: {
      "sonarjs/no-duplicate-string": "off",
    },
  },
  {
    // Tests: relax volume/ceremony rules that fight readable test files.
    files: ["**/*.test.ts", "**/vitest.config.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "jsdoc/require-jsdoc": "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "sonarjs/no-duplicate-string": "off",
    },
  },
  prettier,
);
```

> Aturan-aturan di §9 akan dituangkan juga ke `AGENTS.md` repo agar konsisten
> dipatuhi oleh manusia maupun agen.

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
