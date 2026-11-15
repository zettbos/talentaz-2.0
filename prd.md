# PRD (Product Requirements Document): TalentaZ 2.0

---
## ZONA ATAS: SPESIFIKASI KEBUTUHAN PRODUK (BLUEPRINT AWAL)
---

### 1. Nama Projek & Problem Statement
- **Nama Aplikasi:** **TalentaZ 2.0**
- **Latar Belakang Masalah:** Perusahaan membutuhkan sistem absensi modern yang mudah dipakai karyawan langsung dari browser HP menggunakan foto selfie kamera dan deteksi lokasi GPS, sekaligus memberi Admin/Atasan layar monitoring yang informatif di laptop untuk mengontrol keterlambatan, validasi luar radius, approval izin/cuti/lembur, perhitungan otomatis potongan gaji telat, hingga ekspor laporan resmi PDF ber-Kop Surat dan Excel.

### 2. Peran Pengguna (User Roles)
Sistem menggunakan **2 Peran Utama** dengan autentikasi berbasis database:
1. **Admin (Merangkap Atasan):**
   - Mengelola akun karyawan (tambah user, edit profil/jabatan/gaji pokok, reset password, aktif/nonaktifkan user).
   - Mengatur titik koordinat kantor & radius toleransi absen melalui peta interaktif `Leaflet.js`.
   - Mengatur jadwal jam masuk & pulang global, toleransi telat (menit), nominal potongan tetap per keterlambatan, tarif lembur per jam, serta Kop Surat dinamis (nama instansi, alamat, kontak, logo).
   - Memantau dashboard absensi harian/mingguan/bulanan beserta foto selfie (lengkap dengan watermark) dan alasan telat/luar radius.
   - Memberikan persetujuan (Approve / Tolak + catatan) atas pengajuan **Izin/Sakit/Cuti** dan **Lembur**.
   - Mengunduh Rekap Absensi & Gaji ke **PDF (dengan Kop Surat resmi)** dan **Excel (.xlsx)**.
   - Dapat pula melakukan absensi selfie pribadi jika diperlukan.
2. **Karyawan:**
   - Login menggunakan ID/Username dan password yang dibuatkan Admin.
   - Melakukan **Absen Masuk** dan **Absen Pulang** menggunakan kamera browser (selfie) + deteksi lokasi GPS otomatis.
   - Wajib mengisi alasan jika absen melebihi jam masuk (telat) atau berada di luar radius kantor.
   - Mengajukan **Izin / Sakit / Cuti** beserta unggah lampiran bukti (foto/PDF maks 1 MB) dan memantau status approval.
   - Mengajukan **Lembur** (tanggal, jam mulai, jam selesai, uraian tugas) dan memantau status approval.
   - Melihat riwayat absensi pribadi, jumlah keterlambatan, total potongan gaji, estimasi uang lembur, dan status pengajuan di HP maupun laptop.

### 3. Arsitektur & Lingkungan Kerja
Mengikuti standar resmi `PANDUAN_SETUP_NEXTJS_NEON_VERCEL_GITHUB.md`:
- **Framework:** Next.js (App Router) + TypeScript (Arsitektur Modular berbasis fitur: `src/app/`, `src/components/`, `src/db/`, `src/lib/`).
- **Styling & UI:** Tailwind CSS v4 dengan token desain dari `DESIGN.md` (gaya Mint-Sage & Charcoal Bento sesuai referensi gambar + filter `antislop` DURING mode).
- **Database & ORM:** Neon PostgreSQL (`@neondatabase/serverless`) + Drizzle ORM (`drizzle-orm` & `drizzle-kit`).
- **Autentikasi:** Sesi aman menggunakan HTTP-only signed cookie (HMAC-SHA256 via Node `crypto` + secret di `.env.local` / Vercel env) dan hashing password `bcryptjs`.
- **Peta Interaktif:** `leaflet` (dimuat client-side dengan dynamic import agar aman di SSR Next.js).
- **Pengolahan Foto Selfie (Client-Side):** HTML5 `getUserMedia` + Canvas API untuk mengambil frame kamera, menempelkan **watermark anti-curang** (Nama, Tanggal & Jam WIB, Jarak dari Kantor, Koordinat GPS, Status Radius), lalu mengompresinya menjadi JPEG/WebP ringan (~40-80 KB) sebelum dikirim ke API Neon DB.
- **Ekspor Dokumen:**
  - **PDF Kop Surat:** `jspdf` + `jspdf-autotable` (menghasilkan PDF vektor lengkap dengan logo & header Kop Surat dinamis dari pengaturan Admin, tabel rekap kehadiran/telat/potongan/lembur, dan blok tanda tangan).
  - **Excel (.xlsx):** `exceljs` (menghasilkan spreadsheet rapi dengan header tebal, lebar kolom otomatis, dan format angka Rupiah yang siap diolah).
- **Deployment & VCS:** GitHub (`gh` CLI) + Vercel (`vercel` CLI) dengan database Neon Cloud.

### 4. Alur Kerja Aplikasi (User Flow)
1. **Login (`/login`):**
   - Pengguna memasukkan `username` (atau ID Karyawan) dan `password`.
   - Sistem memverifikasi hash password di Neon DB, membuat HTTP-only session cookie, lalu mengarahkan ke Dashboard (`/dashboard`).
2. **Dashboard Utama (`/dashboard`):**
   - **Desktop Monitoring:** Menampilkan header sapaan, bar progres rasio kehadiran/ketepatan waktu, 3 angka KPI real-time (Total Karyawan, Hadir Hari Ini, Pengajuan Menunggu), kartu profil kiri + akordeon ringkasan gaji/potongan/lembur, grafik progres jam kerja mingguan, *Time Tracker* melingkar + tombol cepat Absen Masuk/Pulang, jadwal timeline mingguan, dan panel *charcoal* kanan berisi daftar approval & aktivitas harian.
   - **Mobile Karyawan:** Menampilkan kartu fokus **Absen Selfie & Status Radius** di bagian paling atas, 2 kartu KPI ringkas berdampingan, daftar pengajuan aktif, dan navigasi bawah 4 menu utama + menu `Lainnya`.
3. **Alur Absen Masuk & Pulang (`/absen` atau Modal Kamera Cepat):**
   - Sistem mengambil lokasi GPS pengguna (`navigator.geolocation`) dan menghitung jarak (rumus Haversine) terhadap titik koordinat kantor dari tabel `company_settings`.
   - Kamera browser aktif (`getUserMedia({ video: { facingMode: "user" } })`). Jika izin kamera ditolak atau tidak tersedia, sistem menampilkan pesan error yang jelas dan panduan izin kamera browser.
   - Sistem mengecek 2 kondisi sebelum tombol kirim aktif:
     - **Cek Jam Kerja (untuk Absen Masuk):** Bandingkan jam WIB saat ini dengan `workStartTime + lateGraceMinutes`. Jika lewat, status menjadi `Terlambat`, field **Alasan Terlambat** otomatis muncul dan wajib diisi, serta nominal potongan telat dihitung sesuai pengaturan.
     - **Cek Radius (Masuk & Pulang):** Jika `distanceMeters > radiusMeters`, status lokasi menjadi `Luar Radius`, field **Alasan di Luar Lokasi** otomatis muncul dan wajib diisi. Absen tetap tercatat sah dengan penanda khusus untuk pantauan Admin.
   - Saat pengguna menekan tombol ambil foto, Canvas menempelkan watermark (Nama, Waktu WIB, Koordinat, Jarak meter) dan mengompresi foto (~50 KB), lalu menyimpannya ke tabel `attendances`.
4. **Alur Izin / Sakit / Cuti (`/pengajuan`):**
   - Karyawan memilih jenis (`Izin`, `Sakit`, `Cuti`), tanggal mulai & selesai, keterangan, dan mengunggah file lampiran (JPG/PNG dikompres otomatis di browser atau PDF maks 1 MB).
   - Admin melihat daftar pengajuan di panel Approval (Dashboard maupun menu Pengajuan), memeriksa lampiran, lalu klik **Setujui** atau **Tolak** dengan catatan opsional.
5. **Alur Pengajuan Lembur (`/lembur`):**
   - Karyawan mengisi tanggal lembur, jam mulai, jam selesai, dan rincian pekerjaan. Sistem menghitung estimasi durasi jam & uang lembur berdasarkan tarif per jam yang diset Admin.
   - Admin meninjau dan klik **Setujui** atau **Tolak**. Lembur yang disetujui otomatis masuk ke rekap dan estimasi gaji.
6. **Kelola Karyawan & Gaji (`/karyawan` - Khusus Admin):**
   - Admin dapat mencari karyawan (filter & pagination di backend), menambah karyawan baru (`username`, nama lengkap, jabatan, role, gaji pokok bulanan, password awal), mengedit data, mereset password, atau menonaktifkan akun.
7. **Pengaturan Lokasi Leaflet.js, Jam Kerja, Potongan & Kop Surat (`/pengaturan` - Khusus Admin):**
   - Peta interaktif `Leaflet.js` (OpenStreetMap): Admin bisa klik/geser pin di peta, cari koordinat, atau geser slider **Radius (meter)** untuk melihat lingkaran jangkauan kantor secara real-time.
   - Pengaturan **Jam Masuk**, **Jam Pulang**, **Toleransi Telat (menit)**, **Potongan Tetap per Telat (Rp)**, dan **Tarif Lembur per Jam (Rp)**.
   - Pengaturan **Kop Surat PDF**: Nama Instansi/Perusahaan, Subjudul/Bidang, Alamat Lengkap, Nomor Telepon/Email, Nama Pimpinan (untuk tanda tangan), dan upload Logo Perusahaan (dikompresi di browser).
8. **Rekap Absensi, Potongan & Download PDF / Excel (`/rekap`):**
   - Filter berdasarkan rentang tanggal / bulan & tahun, pencarian nama/ID karyawan, dan status kehadiran (dieksekusi di backend dengan pagination).
   - Tabel responsif menampilkan total hari hadir, jumlah telat, absen luar radius, izin/cuti, jam lembur disetujui, total potongan telat, uang lembur, dan estimasi gaji bersih.
   - Klik foto selfie pada log harian untuk melihat modal pratinjau foto ber-watermark beserta detail GPS & alasannya.
   - Tombol **Download PDF (Kop Surat)** dan **Download Excel (.xlsx)** menghasilkan file laporan siap cetak/olah sesuai filter aktif.

### 5. Desain Basis Data (Neon PostgreSQL + Drizzle ORM)
Semua skema didefinisikan di `src/db/schema.ts` (tanpa destructive drop pada data produksi):

1. **`users`**
   - `id` (serial PK), `employeeCode` (text unique, auto `EMP-YYYYMM-XXX`), `username` (text unique not null), `passwordHash` (text not null), `fullName` (text not null), `role` (text: `'admin' | 'employee'`), `position` (text not null), `baseSalary` (integer default 0), `avatarDataUrl` (text nullable), `isActive` (boolean default true), `createdAt` (timestamp).
2. **`companySettings`** (`company_settings`)
   - `id` (serial PK, singleton row `id = 1`), `companyName` (text), `companyTagline` (text), `companyAddress` (text), `companyContact` (text), `leaderName` (text), `leaderTitle` (text), `logoDataUrl` (text nullable), `officeLat` (doublePrecision), `officeLng` (doublePrecision), `radiusMeters` (integer default 100), `workStartTime` (text, `'08:00'`), `workEndTime` (text, `'17:00'`), `lateGraceMinutes` (integer default 10), `latePenaltyAmount` (integer default 25000), `overtimeHourlyRate` (integer default 20000), `updatedAt` (timestamp).
3. **`attendances`**
   - `id` (serial PK), `attendanceCode` (text unique, auto `ABS-YYYYMMDD-XXX`), `userId` (integer FK -> `users.id`), `workDate` (text `YYYY-MM-DD` WIB), `clockInAt` (timestamp nullable), `clockInPhoto` (text nullable), `clockInLat` (doublePrecision nullable), `clockInLng` (doublePrecision nullable), `clockInDistanceMeters` (integer nullable), `isLate` (boolean default false), `lateMinutes` (integer default 0), `lateReason` (text nullable), `isOutsideIn` (boolean default false), `outsideInReason` (text nullable), `penaltyAmount` (integer default 0), `clockOutAt` (timestamp nullable), `clockOutPhoto` (text nullable), `clockOutLat` (doublePrecision nullable), `clockOutLng` (doublePrecision nullable), `clockOutDistanceMeters` (integer nullable), `isOutsideOut` (boolean default false), `outsideOutReason` (text nullable), `createdAt` (timestamp).
4. **`leaveRequests`** (`leave_requests`)
   - `id` (serial PK), `requestCode` (text unique, auto `IZN-YYYYMM-XXX`), `userId` (integer FK -> `users.id`), `leaveType` (text: `'izin' | 'sakit' | 'cuti'`), `startDate` (text `YYYY-MM-DD`), `endDate` (text `YYYY-MM-DD`), `reason` (text not null), `attachmentName` (text nullable), `attachmentMime` (text nullable), `attachmentDataUrl` (text nullable), `status` (text: `'pending' | 'approved' | 'rejected'`), `reviewedBy` (integer FK -> `users.id` nullable), `reviewNote` (text nullable), `reviewedAt` (timestamp nullable), `createdAt` (timestamp).
5. **`overtimeRequests`** (`overtime_requests`)
   - `id` (serial PK), `overtimeCode` (text unique, auto `LMB-YYYYMM-XXX`), `userId` (integer FK -> `users.id`), `overtimeDate` (text `YYYY-MM-DD`), `startTime` (text `HH:mm`), `endTime` (text `HH:mm`), `durationMinutes` (integer not null), `taskDescription` (text not null), `estimatedPay` (integer default 0), `status` (text: `'pending' | 'approved' | 'rejected'`), `reviewedBy` (integer FK -> `users.id` nullable), `reviewNote` (text nullable), `reviewedAt` (timestamp nullable), `createdAt` (timestamp).

*Catatan:* Pada inisialisasi/seed pertama yang idempoten, aplikasi otomatis membuat 1 baris `company_settings` default dan 1 akun **Admin awal** (`username: admin`, password awal aman yang bisa langsung diubah Admin setelah login) hanya jika tabel `users` masih kosong.

### 6. Aturan Validasi, Formula Hitung & Logika Khusus
- **Zona Waktu Baku:** Seluruh pencatatan jam masuk, pulang, tanggal kerja, dan validasi keterlambatan menggunakan zona waktu `Asia/Jakarta` (WIB).
- **Penomoran Kode Unik Otomatis (Anti-Tabrakan):**
  - Format: `EMP-YYYYMM-XXX`, `ABS-YYYYMMDD-XXX`, `IZN-YYYYMM-XXX`, `LMB-YYYYMM-XXX`.
  - Dihitung di backend menggunakan pemindaian nilai `MAX` pada prefix periode aktif + 1 (bukan `count + 1`) serta dibungkus pengaman retry/transaction agar aman dari tabrakan.
- **Rumus Keterlambatan & Potong Gaji:**
  - `batasTelat = workStartTime + lateGraceMinutes` (contoh: `08:00 + 10 menit = 08:10`).
  - Jika `clockInWIB > batasTelat`: `isLate = true`, `lateMinutes = selisih menit dari workStartTime`, dan `penaltyAmount = latePenaltyAmount` (nominal tetap dari Pengaturan). Karyawan **wajib** mengisi `lateReason` (min 5 karakter).
- **Rumus Radius GPS (`Leaflet.js` & Haversine):**
  - Jarak meter dihitung dengan rumus Haversine antara `(lat, lng)` perangkat dan `(officeLat, officeLng)`.
  - Jika `distanceMeters > radiusMeters`: `isOutside = true`, karyawan **wajib** mengisi alasan di luar lokasi (min 5 karakter), namun absen tetap masuk agar tidak memblokir pekerja lapangan, disertai label `"Luar Radius"` untuk audit Admin.
- **Rumus Lembur & Estimasi Gaji Bulanan:**
  - `durationMinutes = selisih(endTime, startTime)` (mendukung lembur melewati tengah malam jika `endTime < startTime` atau validasi eksplisit).
  - `estimatedPay = Math.round((durationMinutes / 60) * overtimeHourlyRate)`.
  - `Estimasi Gaji Bersih = baseSalary - totalPenaltyTelat + totalApprovedOvertimePay`.
- **Kompresi & Keamanan Media:**
  - Selfie kamera dikompresi di Canvas browser (`maxWidth: 640px`, JPEG quality `0.72`, + overlay bar watermark info waktu WIB, nama, jarak & koordinat) sehingga ukuran rata-rata ~45-70 KB.
  - Lampiran Izin/Sakit/Cuti: jika berupa gambar akan dikompresi otomatis ke maks ~250 KB; jika berupa PDF dibatasi maks `1 MB` sebelum encode Data URL agar kuota gratis Neon 0,5 GB awet jangka panjang.
- **Performa Backend Search, Filter & Pagination + Cache State:**
  - Daftar log absensi, data karyawan, pengajuan izin/lembur, dan tabel rekap memakai query backend (`WHERE`, `ILIKE`, `LIMIT`, `OFFSET`) yang mengembalikan total halaman.
  - Di sisi klien, perpindahan tab/menu mempertahankan cache state sementara dan langsung meng-invalidate cache saat terjadi mutasi (absen baru, approval, simpan user, simpan setting).
- **Keamanan & Anti-Freeze UI:**
  - Seluruh password di-hash dengan `bcryptjs`, cookie sesi memakai `httpOnly`, `sameSite: 'lax'`, `secure` di production, dan setiap API route memvalidasi sesi + otorisasi role (`admin` vs `employee`).
  - Semua form tombol submit memiliki loading state, `try/catch/finally` untuk mengembalikan tombol aktif saat error, serta toast/modal kustom (tanpa `alert()`/`confirm()` bawaan browser).

### 7. Rencana Antarmuka & Pemetaan Layar
Semua halaman terhubung nyata lewat navigasi (tidak ada tautan mati):
1. **`/login`:** Form login bersih (ID/Username + Password + tombol tampilkan password) berdesain Mint-Sage & Charcoal, tanpa klaim statistik fiktif.
2. **`/dashboard`:** Halaman utama bergaya Mint-Sage & Charcoal Bento sesuai referensi gambar (Hero greeting + progress pills + 3 KPI real-time; Left Profile + Accordion Gaji/Shift; Center Weekly Hours Chart + Time Tracker Ring + Timeline Jadwal; Right Split Progress + Dark Charcoal Checklist & Pending Approvals). Di HP menyusun ulang dengan kartu Absen Selfie Cepat di paling atas + 2-kolom KPI + Bottom Navigation.
3. **`/absen`:** Layar kamera selfie browser + peta mini jarak lokasi saat ini vs kantor + validasi otomatis field alasan telat & alasan luar radius + riwayat absen hari ini.
4. **`/pengajuan`:** Tab terpadu **Izin / Sakit / Cuti** (upload lampiran + preview + approval Admin) dan **Lembur** (input jam lembur + hitung estimasi tarif + approval Admin).
5. **`/rekap`:** Filter tanggal/bulan, pencarian karyawan, status, pagination backend, pratinjau foto selfie watermark, tombol **Download PDF (Kop Surat)**, dan **Download Excel (.xlsx)**.
6. **`/karyawan` (Admin):** Manajemen akun karyawan (tambah user, beri/reset password, atur gaji pokok & jabatan, pencarian & pagination).
7. **`/pengaturan` (Admin):** Peta interaktif `Leaflet.js` (geser pin + cari alamat/koordinat + slider radius meter + lingkaran area), jam kerja & aturan potongan telat/tarif lembur, serta editor Kop Surat PDF (nama instansi, alamat, kontak, penandatangan, upload logo).

### 8. Kriteria Pengujian (Checklist Verifikasi User)
- [ ] Login berhasil sebagai Admin dan Karyawan dari akun di database Neon; password salah ditolak dengan pesan jelas.
- [ ] Admin dapat membuat akun karyawan baru beserta password, dan akun baru tersebut langsung bisa login.
- [ ] Admin dapat menggeser pin lokasi kantor di peta `Leaflet.js`, mengubah radius (misal 100 m), dan menyimpannya ke database.
- [ ] Karyawan bisa membuka kamera browser untuk selfie Absen Masuk & Pulang; foto tersimpan disertai watermark waktu, jarak, dan koordinat.
- [ ] Jika karyawan absen lewat jam toleransi, form wajib meminta Alasan Telat dan langsung mencatat nominal Potongan Gaji.
- [ ] Jika karyawan absen di luar radius peta kantor, form wajib meminta Alasan di Luar Lokasi dan menandai log sebagai Luar Radius.
- [ ] Karyawan dapat mengajukan Izin/Sakit/Cuti dengan lampiran dan mengajukan Lembur; Admin dapat menyetujui atau menolak dari UI.
- [ ] Halaman Rekap menampilkan data akurat sesuai filter, serta tombol Download PDF (dengan Kop Surat dan logo) dan Download Excel (.xlsx) menghasilkan file valid.
- [ ] Tampilan nyaman diuji pada lebar layar HP (~375px tanpa scroll horizontal dan tombol mudah disentuh) maupun layar Laptop (~1280px+ sesuai layout Bento referensi).

---
## ZONA BAWAH: MASTER CONTEXT & LOGIKA SISTEM TERKINI (LIVING CONTEXT)
---

- **Status Arsitektur & Lingkungan Aktif:**
  - Stack & Hosting: Next.js `16.4.6` (App Router, `src/proxy.ts` verifikasi token HMAC + guard role admin di Node.js runtime, route group `src/app/(protected)/` dengan shared `layout.tsx` & `loading.tsx`, `experimental.staleTimes` `{ dynamic: 30, static: 180 }`) + React `19.3.0` + TypeScript + Tailwind CSS `4.3.3` + Drizzle ORM `0.45.4` + Neon PostgreSQL (`aws-ap-southeast-1` Singapura via `@neondatabase/serverless`) + Vercel Production (`talentaz-2-0.vercel.app`, region `sin1` Singapura lewat `vercel.json`).
  - Keamanan HTTP Headers & Kredensial:
    - `next.config.ts` mengirim Security Headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), geolocation=(self), microphone=()`, `X-DNS-Prefetch-Control: on`, `Content-Security-Policy` yang mendukung kamera selfie, OpenStreetMap tiles, dan ekspor blob).
    - `src/app/robots.ts` mengatur aturan crawler untuk portal internal, `src/app/layout.tsx` mendukung `GOOGLE_SITE_VERIFICATION`, dan kredensial demo tidak pernah ditampilkan di UI `/login` pada build produksi.
  - Performa Navigasi & Backend Query:
    - `src/lib/session.ts` memisahkan verifikasi token HMAC dari query DB & `bcryptjs`; `getCurrentUser()` di `src/lib/auth.ts` hanya membaca kolom non-sensitif tanpa `ensureInitialized()`.
    - `ensureInitialized()` (`src/db/seed.ts`) hanya dipanggil pada `POST /api/auth/login` untuk inisialisasi DB baru (tidak lagi berjalan di setiap GET runtime maupun pergantian menu).
    - Endpoint API utama (`dashboard`, `attendances`, `leaves`, `overtimes`, `reports`, `users`) mengeksekusi query independen secara paralel memakai `Promise.all(...)`.
    - Frontend menggunakan persistent shell `ProtectedShellContext` (`AppShell` tidak unmount saat pindah menu) serta `DataCacheContext` + `useCachedQuery` (deduplikasi request, prefetch API saat hover/focus/touch link, dan latar belakang SWR setelah `15 detik`).
  - Modul Inti Terimplementasi:
    - Database & Seed: `src/db/schema.ts`, `src/db/index.ts`, `src/db/seed.ts`, `drizzle.config.ts`.
    - Utilitas: `src/lib/session.ts`, `src/lib/auth.ts`, `src/lib/settings-defaults.ts`, `src/lib/time.ts`, `src/lib/geo.ts`, `src/lib/codes.ts`, `src/lib/media-client.ts`, `src/lib/export-reports.ts`, `src/lib/use-cached-query.ts`.
    - API Route Handlers (`13` endpoints): `/api/auth/login|logout|me`, `/api/dashboard`, `/api/attendances`, `/api/leaves`, `/api/leaves/[id]`, `/api/overtimes`, `/api/overtimes/[id]`, `/api/reports`, `/api/users`, `/api/users/[id]`, `/api/settings`.
    - Halaman & Komponen UI: `src/proxy.ts`, `src/app/page.tsx`, `src/app/robots.ts`, `/login`, Route Group `src/app/(protected)/` (`layout.tsx`, `loading.tsx`, `/dashboard`, `/absen`, `/pengajuan`, `/rekap`, `/karyawan`, `/pengaturan`), dan shell bersama (`ProtectedShellContext`, `AppShell`, `DataCacheContext`, `ToastContext`, `Modal`, `Icons`).
  - Status Verifikasi: Schema Drizzle sudah di-push ke Neon (`aws-ap-southeast-1`), kode terpasang di GitHub (`zettbos/talentaz-2.0`) dan ter-deploy ke Vercel (`talentaz-2-0.vercel.app`), serta verifikasi `tsc --noEmit`, `eslint`, dan `next build` telah lulus tanpa error.
- **Skema Kolom Database Terkini:**
  - `users`: `id`, `employee_code`, `username`, `password_hash`, `full_name`, `role`, `position`, `base_salary`, `avatar_data_url`, `is_active`, `created_at`
  - `company_settings`: `id`, `company_name`, `company_tagline`, `company_address`, `company_contact`, `leader_name`, `leader_title`, `logo_data_url`, `office_lat`, `office_lng`, `radius_meters`, `work_start_time`, `work_end_time`, `late_grace_minutes`, `late_penalty_amount`, `overtime_hourly_rate`, `updated_at`
  - `attendances`: `id`, `attendance_code`, `user_id`, `work_date`, `clock_in_at`, `clock_in_photo`, `clock_in_lat`, `clock_in_lng`, `clock_in_distance_meters`, `is_late`, `late_minutes`, `late_reason`, `is_outside_in`, `outside_in_reason`, `penalty_amount`, `clock_out_at`, `clock_out_photo`, `clock_out_lat`, `clock_out_lng`, `clock_out_distance_meters`, `is_outside_out`, `outside_out_reason`, `created_at`
  - `leave_requests`: `id`, `request_code`, `user_id`, `leave_type`, `start_date`, `end_date`, `reason`, `attachment_name`, `attachment_mime`, `attachment_data_url`, `status`, `reviewed_by`, `review_note`, `reviewed_at`, `created_at`
  - `overtime_requests`: `id`, `overtime_code`, `user_id`, `overtime_date`, `start_time`, `end_time`, `duration_minutes`, `task_description`, `estimated_pay`, `status`, `reviewed_by`, `review_note`, `reviewed_at`, `created_at`
- **Logika Bisnis & Formula Hitung Berlaku:**
  - Peran: 2 role (`admin` merangkap atasan, `employee`).
  - Absen Telat: `clockInWIB > workStartTime + lateGraceMinutes` -> wajib alasan telat + potongan nominal tetap `latePenaltyAmount`.
  - Luar Radius: `haversine(userLatLng, officeLatLng) > radiusMeters` -> absen tetap sah, ditandai `Luar Radius`, wajib alasan luar lokasi.
  - Lembur: `(durationMinutes / 60) * overtimeHourlyRate` masuk hitungan gaji setelah status `approved`.
  - Media: Kompresi browser + watermark JPEG (~45-70 KB) & lampiran maks 1 MB disimpan ke Neon PostgreSQL.
- **Log Pembaruan Resmi:**
  - `v1.0 (Draft PRD Awal)`: Penyusunan spesifikasi awal TalentaZ 2.0 dan arah visual `DESIGN.md` Mint-Sage & Charcoal Bento.
  - `v2.0 (Implementasi Fullstack & Deploy Pertama)`: Implementasi lengkap seluruh halaman, API route handlers, skema Drizzle ORM, push Neon DB, upload repo GitHub, dan deploy awal ke Vercel.
  - `v2.1 (Revisi Kecepatan Navigasi 0-Delay & Hardening Keamanan)`: Penyelarasan region `sin1` (`vercel.json`), migrasi Shared Layout `(protected)` + `loading.tsx` + `staleTimes`, paralelisasi query `Promise.all`, pemisahan `ensureInitialized` ke login, warm prefetch SWR cache, HTTP Security Headers + CSP di `next.config.ts`, `robots.ts`, serta sanitasi halaman login produksi.
