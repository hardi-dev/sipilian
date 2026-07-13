# Fase 4 — `packages/api` (RPC Server Functions) — Design Spec

- **Tanggal:** 2026-07-13
- **Status:** Disetujui (siap masuk rencana implementasi)
- **Induk:** [Sipilian SKD App Design](./2026-07-12-sipilian-skd-app-design.md) §9.8.4, §12 Fase 4
- **Ruang lingkup:** Batas API walking-skeleton (learn + tryout end-to-end) sebagai handler agnostik-framework

---

## 1. Tujuan

Menyediakan **lapisan batas API** yang menjembatani klien (web admin & mobile) ke
logika domain (`@sipilian/core`) dan data (`@sipilian/db`). Handler bersifat **tipis**:
parse input (Zod) → delegasi ke `core`/`db` → petakan `Err` domain ke `ApiError`.
Tidak ada logika bisnis di handler (§9.8.4).

Menyalakan **seluruh batas API walking-skeleton**: baca konten, submit lesson,
mulai/submit tryout, sinkron progres, set entitlement.

## 2. Keputusan Kunci (hasil brainstorming)

| Aspek              | Keputusan                                                                        |
| ------------------ | -------------------------------------------------------------------------------- |
| Bentuk API         | **Handler agnostik-framework** `action(input, ctx)` → `Result<Output, ApiError>` |
| Context            | `RequestContext { userId, db, now }` — session→userId di-resolve di Fase 5       |
| Kopling auth       | `api` **tidak** impor `@sipilian/auth`; hanya `core` + `db`                      |
| Cakupan            | **Set lengkap §9.8.4** (content, lessons, tryouts, progress, entitlements)       |
| Idempotensi        | `idempotencyKey` + tabel `request_idempotency` untuk submitLesson/submitTryout   |
| Determinisme waktu | `ctx.now` di-inject ke fungsi `core` (streak, review) di batas API               |
| Error → HTTP       | `ApiError { code, httpStatus, message }` + `toHttp()` terpusat                   |
| Testing            | Unit (schema, http, idempotency) + integrasi vs Neon dev `neondb` (dgn cleanup)  |

## 3. Arsitektur & Boundary

### Kontrak handler

```ts
export type Handler<Input, Output> = (
  input: Input,
  ctx: RequestContext,
) => Promise<Result<Output, ApiError>>;

export interface RequestContext {
  readonly userId: string; // di-resolve dari sesi di batas web/mobile (Fase 5)
  readonly db: Db; // instance Drizzle bersama dari @sipilian/db
  readonly now: Date; // jam server, di-inject untuk skoring/streak/review deterministik
}
```

### Arah dependensi

- `api` **boleh** impor `@sipilian/core` + `@sipilian/db`.
- `api` **dilarang** impor `react`/`react-native`/`**/apps/**` (§9.8.4).
- `api` **tidak** impor `@sipilian/auth` — resolusi `userId` dari sesi terjadi di
  Fase 5; ini membuat Fase 4 tak terblokir merge Fase 3 dan bisa diuji integrasi
  sekarang.
- Ditegakkan via ESLint `no-restricted-imports` (blok baru `packages/api/**`).

### Alur

Klien → (Fase 5: resolve sesi → `ctx.userId`) → `handler(input, ctx)` → `core`/`db`
→ `Result` → (Fase 5: `toHttp` jika `Err`, atau serialisasi `Ok`).

## 4. Struktur File

```
packages/api/
├─ package.json          # @sipilian/api; exports "."
├─ tsconfig.json
├─ vitest.config.ts      # load root .env untuk DATABASE_URL; coverage ≥80
└─ src/
   ├─ context.ts         # RequestContext
   ├─ http.ts            # ApiError, ApiErrorCode, toHttp()
   ├─ idempotency.ts     # withIdempotency(ctx, key, fn)
   ├─ content/           # content.schema.ts + content.handler.ts
   ├─ lessons/           # lessons.schema.ts + lessons.handler.ts
   ├─ tryouts/           # tryouts.schema.ts + tryouts.handler.ts
   ├─ progress/          # progress.schema.ts + progress.handler.ts
   ├─ entitlements/      # entitlements.schema.ts + entitlements.handler.ts
   ├─ index.ts           # barrel
   └─ **/*.test.ts       # colocated
```

Perubahan di `@sipilian/db`: tabel `request_idempotency` + migrasi baru.

## 5. Handler (verba per §9.8.4)

| Handler           | Input (Zod)                                | Delegasi                                                        | Idempotensi         |
| ----------------- | ------------------------------------------ | --------------------------------------------------------------- | ------------------- |
| `getLearningPath` | `{ subtestKind }`                          | `db` (subtests→topics→units→lessons)                            | baca                |
| `getLesson`       | `{ lessonId }`                             | `db` (lesson + questions + options)                             | baca                |
| `submitLesson`    | `{ lessonId, answers[], idempotencyKey }`  | `core.calculateXp/updateStreak/scheduleReview` + tulis `db`     | **key**             |
| `startTryout`     | `{ packageId }`                            | `db` (insert attempt `endedAt=null`, atau kembalikan yg aktif)  | reuse attempt aktif |
| `submitTryout`    | `{ attemptId, answers[], idempotencyKey }` | `core.scoreObjectiveSubtest/scoreTkpSubtest/scoreTryout` + `db` | **key** + `endedAt` |
| `syncProgress`    | `{ items[] }`                              | `db` upsert (`user_question_states`, `daily_activity`)          | upsert              |
| `setEntitlement`  | `{ userId, plan, expiresAt }`              | `db` upsert (`entitlements`)                                    | upsert              |

### Catatan mekanik penting

- **Injeksi waktu:** `submitLesson` memberi `ctx.now` (tanggal server) ke
  `updateStreak.activityDate` & menghitung `nextReviewAt` dari `scheduleReview`
  `intervalDays` (core hanya mengembalikan interval, bukan tanggal).
- **Skoring server:** `submitTryout` menghitung skor via `core` (bukan klien);
  TKP berbobot 1–5, passing grade per subtes dari `subtests` (§4 induk).
- **`getLearningPath.subtestKind`** memakai `SubtestKind` (`"twk"|"tiu"|"tkp"`) dari
  `@sipilian/core`.
- **Streak awal:** bila `user_stats` belum ada / `last_activity_date` `null`,
  `submitLesson` membuat state awal (`currentStreak=1`) tanpa memanggil `updateStreak`
  (yang mengasumsikan ada `previous.lastActivityDate`).
- **`ease_factor`** disimpan `numeric(3,2)` (string di DB) — handler konversi
  ke/dari `number` saat baca/tulis `user_question_states`.
- **Lifecycle attempt:** timer = sumber-kebenaran server. `startTryout` menyimpan
  `started_at` saat mulai; skor diisi saat submit (lihat §6.1).

## 6. Idempotensi & Perubahan Skema DB

### 6.1 Perubahan skema `@sipilian/db` (satu migrasi baru)

Dua perubahan digabung dalam satu migrasi `0001_*` (Fase 4):

1. **Tabel baru `request_idempotency`** (lihat §6.2).
2. **`tryout_attempts` — kolom skor jadi nullable.** `twk_score`, `tiu_score`,
   `tkp_score`, `total_score`, `passed_all` diubah `DROP NOT NULL`. Alasan:
   attempt dibuat saat **start** (skor belum ada) dan diisi saat **submit**.
   `ended_at IS NULL` menandai attempt **berjalan**; terisi = **selesai**. Ini
   menegakkan timer sumber-kebenaran server (§10.1 induk) tanpa kolom `status`
   tambahan.

### 6.2 Tabel `request_idempotency`

- Kolom: `id`, `user_id` (FK users, cascade), `key` (text), `response` (jsonb),
  `created_at`. **Unique `(user_id, key)`**.
- Helper `withIdempotency(ctx, key, fn)`:
  1. Cari baris `(ctx.userId, key)`. Jika ada → kembalikan `response` tersimpan
     (di-cast ke `Output`).
  2. Jika tidak → jalankan `fn()`, simpan hasil `Ok` sebagai `response`, kembalikan.
  3. Hanya hasil `Ok` yang di-cache; `Err` tidak disimpan (boleh retry).
- Membungkus `submitLesson` & `submitTryout`. `submitTryout` **juga** dijaga
  `ended_at` (attempt sudah `ended_at != null` → kembalikan skor tersimpan) sebagai
  pertahanan kedua.

## 7. Model Error

```ts
export type ApiErrorCode =
  "validation_failed" | "not_found" | "forbidden" | "conflict" | "unprocessable";

export interface ApiError {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
  readonly message: string;
}

export interface HttpError {
  readonly status: number;
  readonly body: HttpErrorBody;
}

export interface HttpErrorBody {
  readonly code: ApiErrorCode;
  readonly message: string;
}
```

- `toHttp(error: ApiError): HttpError` — pemetaan terpusat (mis. `validation_failed`→422,
  `not_found`→404, `forbidden`→403, `conflict`→409).
- Kode error domain dari `core` (mis. `invalid_tkp_weight`, `negative_correct_count`)
  dipetakan ke `ApiError` (`unprocessable`/422) di handler.
- Error tak terduga (bug) **dilempar** & ditangkap handler terpusat Fase 5 (bukan
  `ApiError`).
- **Konvensi (AGENTS.md):** di `*.handler.ts` dilarang `throw` untuk error yang
  diharapkan — kembalikan `Err(ApiError)`.

## 8. Context & Sesi (batas Fase 4 ↔ Fase 5)

- Fase 4 menerima `ctx.userId` sudah ter-resolve. Fase 5 (`apps/web`) membuat `ctx`:
  resolve sesi via `@sipilian/auth` → `userId`, sediakan `db` bersama, `now = new Date()`.
- **`setEntitlement`**: otorisasi admin ditegakkan di layout web (§9.8.5). Handler
  mempercayai `ctx`; cek peran defense-in-depth ditunda bersama integrasi auth.

## 9. Strategi Pengujian

### Unit (deterministik)

- Tiap `*.schema.ts`: parse valid → objek bertipe; input cacat → error Zod.
- `http.ts`: tiap `ApiErrorCode` → status benar; bentuk `HttpErrorBody` benar.
- `idempotency.ts`: run pertama menjalankan `fn` & menyimpan; run kedua (key sama)
  mengembalikan cache tanpa memanggil `fn`; `Err` tak di-cache.

### Integrasi (vs Neon dev `neondb`, dengan cleanup)

- Seed konten minimal (subtes, topik, unit, lesson, soal, opsi; paket tryout) di
  `beforeAll`; insert user uji langsung ke tabel `users`.
- `submitLesson`: assert completion, XP/streak, review state tersimpan; **replay
  dengan idempotencyKey sama tidak menggandakan**.
- `startTryout`/`submitTryout`: assert skor per subtes benar (TKP berbobot),
  lulus/tidak; replay aman.
- `syncProgress` & `setEntitlement`: assert upsert.
- **Cleanup wajib** di `afterAll`: hapus data uji (user cascade + konten seed).

## 10. Dampak CI & Env

- Job `test` memakai secret `DATABASE_URL` (Neon dev) yang sudah ditambahkan Fase 3.
  Fase 4 tidak menambah secret baru (`api` tak perlu `BETTER_AUTH_SECRET`).
- `packages/api/vitest.config.ts` memuat root `.env` (pola sama Fase 3) agar
  integrasi jalan lokal.

## 11. Definition of Done (Fase 4)

Selaras §9.6 induk: **test lulus · lint bersih (SonarJS + batas ukuran) · typecheck
lolos · coverage kode baru ≥ 80%**. Ditambah:

- Migrasi Fase 4 ter-apply ke Neon & terverifikasi: tabel `request_idempotency`
  ada + kolom skor `tryout_attempts` menjadi nullable.
- Integrasi learn + tryout hijau terhadap Neon dev, replay idempoten terbukti.
- ESLint override `packages/api/**` aktif (ban `react`/`react-native`/`apps`, boleh
  `core`/`db`).

## 12. Di Luar Cakupan Fase 4 (fase lain)

- **Pembungkusan TanStack Start `createServerFn` + resolusi sesi→userId → Fase 5.**
  Fase 4 menghasilkan handler & schema yang tinggal dibungkus.
- Cek peran admin defense-in-depth di `setEntitlement` (bersama integrasi `auth`).
- Enforcement entitlement (gating premium) di sisi klien (Fase mobile/web).
- Rate limiting, analitik, moderasi — pasca-MVP.
