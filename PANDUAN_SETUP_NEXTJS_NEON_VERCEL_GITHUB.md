# 🚀 Official Playbook: Setup Next.js + Neon PostgreSQL + GitHub + Vercel
> **By Zettbos — Ekosistem `/zettbot` & Antigravity IDE (100% Terminal-First)**  
> Panduan langkah demi langkah khusus untuk **Member Zettbos** (ramah pemula absolut hingga *power user*) dari install alat dasar, membuat aplikasi bersama **`/zettbot`**, hingga live online gratis!

---

> [!IMPORTANT]  
> 📸 **ATURAN EMAS ZETTBOS: BINGUNG ATAU ERROR? LANGSUNG SCREENSHOT!**  
> Kamu tidak harus hafal atau paham semua istilah terminal. Jika di tengah jalan muncul tulisan merah (*error*), tampilan berbeda dari panduan, atau kamu ragu mau pencet tombol apa:  
> **Ambil screenshot layar/terminalmu, lalu kirimkan langsung ke chat Antigravity.** AI akan langsung membaca gambarmu dan memandu langkah perbaikannya!

---

> [!NOTE]
> 🤖 **INSTRUKSI INTEGRASI UNTUK AI (`/zettbot` & ANTIGRAVITY ASSISTANT):**  
> Jika file ini ada di workspace bersama skill `/zettbot` (atau `ZettBOT.md`):  
> 1. **Gunakan Stack Resmi Playbook Ini:** Saat melakukan wawancara PRD (`prd.md`) dan membangun proyek web fullstack, gunakan arsitektur **Next.js (App Router) + TypeScript + Tailwind CSS + Drizzle ORM + Neon PostgreSQL + GitHub + Vercel** sesuai tahapan di file ini.  
> 2. **Cek Lingkungan Dulu:** Sebelum mengeksekusi perintah apapun, selalu periksa kondisi folder (`pwd` / isi direktori), status instalasi (`node`, `git`, `gh`), dan status login CLI (`gh auth status`, `npx vercel whoami`, `npx neonctl me`).  
> 3. **Anti-Conflict Saat Folder Sudah Berisi File `.md`:** Jika user memasukkan file panduan ini atau `ZettBOT.md` ke dalam folder kosong sebelum `create-next-app`, amankan file `.md` sementara (atau pindahkan ke temp lalu kembalikan) agar `npx create-next-app .` tidak gagal karena folder dianggap tidak kosong!  
> 4. **Patuhi Protokol ZettBOT:** Tetap jalankan aturan `prd.md`, Desain Anti-AI, Mobile-Friendly First, non-destructive DB, serta **dilarang menjalankan localhost test sepihak tanpa izin user**.

---

## 📋 Daftar Isi
1. [Cara Pakai Playbook Ini (Khusus Member Zettbos)](#1-cara-pakai-playbook-ini-khusus-member-zettbos)
2. [Fase Persiapan: Cek Alat Dasar & Terminal](#2-fase-persiapan-cek-alat-dasar--terminal)
3. [Fase 0: Cek & Login Akun di Terminal (GitHub, Vercel, Neon)](#3-fase-0-cek--login-akun-di-terminal-github-vercel-neon)
4. [Fase 1: Cek Folder Kerja & Inisialisasi Next.js](#4-fase-1-cek-folder-kerja--inisialisasi-nextjs)
5. [Fase 2: Bikin Database Neon dari Terminal & Amankan `.env.local`](#5-fase-2-bikin-database-neon-dari-terminal--amankan-envlocal)
6. [Fase 3: Setup Drizzle ORM & Auto-Push Skema ke Neon](#6-fase-3-setup-drizzle-orm--auto-push-skema-ke-neon)
7. [Fase 4: Bangun Aplikasi (`/zettbot` Mode vs Latihan Tes Koneksi)](#7-fase-4-bangun-aplikasi-zettbot-mode-vs-latihan-tes-koneksi)
8. [Fase 5: Cek Build & Push ke GitHub Tanpa Buka Web](#8-fase-5-cek-build--push-ke-github-tanpa-buka-web)
9. [Fase 6: Deploy ke Vercel via Terminal](#9-fase-6-deploy-ke-vercel-via-terminal)
10. [Fase 7: Trik Otomasi "Auto-Migrate Saat Git Push"](#10-fase-7-trik-otomasi-auto-migrate-saat-git-push)
11. [Troubleshooting Pemula & Solusi Error Umum](#11-troubleshooting-pemula--solusi-error-umum)

---

## 1. Cara Pakai Playbook Ini (Khusus Member Zettbos)

1. Buat satu folder baru di komputermu untuk proyek ini (contoh: `aplikasi-kasir-gw`).
2. Buka folder tersebut di **Antigravity IDE**.
3. Masukkan file `.md` panduan ini ke dalam folder tersebut.
4. Buka chat Antigravity, ketik **`/zettbot`**, lalu bilang:  
   > *"Pandu gw setup projek dari awal pake file panduan ini ya."*
5. ZettBOT akan memandumu berurutan mulai dari cek terminal sampai aplikasimu live!

---

## 2. Fase Persiapan: Cek Alat Dasar & Terminal

### A. Daftar Akun Gratis (Wajib Ada, Tanpa Kartu Kredit)
Buat akun gratis di 3 website ini terlebih dahulu:
- [GitHub](https://github.com)
- [Vercel](https://vercel.com) *(Pilih "Continue with GitHub" agar lebih praktis)*
- [Neon.tech](https://neon.tech) *(Pilih "Continue with GitHub" agar lebih praktis)*

### B. Cara Membuka Terminal di Antigravity
- Tekan tombol **`Ctrl` + `` ` ``** (tombol di sebelah kiri angka `1`), atau klik menu atas **Terminal → New Terminal**.

### C. Cek Node.js & Git (Apakah Sudah Terinstall?)
Ketik satu per satu di terminal:
```bash
node -v
git -v
```
- **Jika muncul angka versi** (contoh: `v20.x.x` dan `git version 2.x.x`), lanjut ke langkah D!
- **Jika muncul tulisan merah** (`not recognized` / `command not found`):
  Install otomatis lewat terminal Windows (PowerShell):
  ```powershell
  winget install OpenJS.NodeJS.LTS
  winget install Git.Git
  ```
  *(Setelah selesai install, **WAJIB tutup Antigravity lalu buka lagi** agar terminal mengenali Node dan Git).*

### D. Setting Identitas Git (Wajib untuk yang Belum Pernah Pakai Git!)
Jika belum pernah setting Git di laptop ini, `git commit` nanti akan ditolak. Cek dulu:
```bash
git config user.name
git config user.email
```
Jika hasilnya **kosong**, jalankan perintah ini (ganti dengan nama dan email akun GitHub-mu):
```bash
git config --global user.name "Nama Kamu"
git config --global user.email "emailgithubkamu@gmail.com"
```

### E. Anti-Blokir Script Windows PowerShell (Sering Terjadi di Pemula)
Jika nanti saat mengetik `npx` atau `npm` muncul error merah bertuliskan `running scripts is disabled on this system`, jalankan perintah ini sekali saja di PowerShell:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
*(Jika ditanya `[Y] Yes`, ketik **Y** lalu Enter).*

> 📸 *Bingung atau muncul error merah saat cek alat di atas? **Screenshot terminalnya dan kirim ke chat sekarang!***

---

## 3. Fase 0: Cek & Login Akun di Terminal (GitHub, Vercel, Neon)

> **Prinsip Cepat:** Kita cek dulu apakah kamu sudah pernah login. Jika sudah login, langsung lewati (*skip*) ke tahap berikutnya!

### A. GitHub CLI (`gh`)
1. Cek apakah `gh` sudah terpasang:
   ```bash
   gh --version
   ```
   Jika belum terpasang di Windows:
   ```powershell
   winget install --id GitHub.cli
   ```
   *(Tutup dan buka ulang terminal jika baru install).*

2. Cek status login GitHub:
   ```bash
   gh auth status
   ```
   - Jika muncul `Logged in to github.com`, **LEWATI langkah nomor 3!**
   - Jika belum login, jalankan langkah nomor 3:

3. Login GitHub di terminal:
   ```bash
   gh auth login
   ```
   Ikuti pilihan di layar:
   - *What account do you want to log into?* → Pilih **GitHub.com** (Enter).
   - *What is your preferred protocol for Git operations?* → Pilih **HTTPS** (Enter).
   - *Authenticate Git with your GitHub credentials?* → Ketik **Y** (Enter).
   - *How would you like to authenticate GitHub CLI?* → Pilih **Login with a web browser** (Enter).
   - Terminal menampilkan kode 8 digit (misal: `A1B2-C3D4`). Tekan **Enter**, browser akan terbuka, masukkan kode tersebut, lalu klik **Authorize**.

---

### B. Vercel CLI
1. Cek apakah sudah login Vercel:
   ```bash
   npx vercel whoami
   ```
   *(Jika ditanya `Ok to proceed? (y)`, ketik **y** lalu Enter).*
   - Jika muncul username kamu, **LEWATI langkah nomor 2!**
   - Jika muncul error belum login, jalankan langkah nomor 2:

2. Login Vercel:
   ```bash
   npx vercel login
   ```
   - Pilih **Continue with GitHub** (pakai tombol panah atas/bawah lalu Enter).
   - Klik konfirmasi di browser yang terbuka hingga terminal menampilkan `Success!`.

---

### C. Neon CLI (`neonctl`)
1. Cek apakah sudah login Neon:
   ```bash
   npx neonctl me
   ```
   *(Jika ditanya `Ok to proceed? (y)`, ketik **y** lalu Enter).*
   - Jika muncul email/nama akun Neon kamu, **LEWATI langkah nomor 2!**
   - Jika belum login, jalankan langkah nomor 2:

2. Login Neon:
   ```bash
   npx neonctl auth
   ```
   - Browser akan terbuka ke halaman Neon Console.
   - Klik **Authorize / Grant Access** hingga terminal menyatakan berhasil.

> 📸 *Macet saat login GitHub, Vercel, atau Neon? **Screenshot terminal atau browsermu dan kirim ke chat Antigravity!***

---

## 4. Fase 1: Cek Folder Kerja & Inisialisasi Next.js

> [!WARNING]  
> **ANTI-NESTED FOLDER & ANTI-KONFLIK FILE `.md`!**  
> Pemula sering terjebak 2 masalah ini:
> 1. Folder bersarang (misal: `projek-gw/projek-gw`).
> 2. `create-next-app` menolak berjalan karena folder sudah berisi file `ZettBOT.md` atau file panduan `.md` ini!

### Langkah 1: Cek Posisi & Isi Folder
Ketik di terminal:
```bash
pwd
ls
```

### Langkah 2: Pilih Kondisi yang Sesuai dengan Layarmu:

#### 🟢 KONDISI A: Sudah di dalam folder projek sendiri, DAN folder masih kosong
Langsung install Next.js ke folder aktif menggunakan tanda titik (`.`):
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

#### 🟠 KONDISI B: Sudah di dalam folder projek sendiri, TAPI sudah ada file `.md` ini / `ZettBOT.md`
Jika langsung jalankan `create-next-app .`, biasanya akan ditolak dengan error *"The directory contains files that could conflict"*.  
**Solusi Instan:** Minta langsung ke ZettBOT di chat:
> *"Folder gw udah ada file md / ZettBOT.md, tolong inisialisasi Next.js di folder ini dengan aman biar ga bentrok."*
*(AI akan memindahkan `.md` sementara, menjalankan instalasi Next.js, lalu mengembalikan file `.md`-nya ke tempat semula secara rapi).*

#### 🟡 KONDISI C: Belum bikin folder projek sama sekali (masih di `C:\Users\...` atau `Desktop`)
Buat folder dulu dan masuk ke dalamnya:
```bash
mkdir nama-projek-kamu
cd nama-projek-kamu
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

> 📸 *Ragu kamu ada di Kondisi A, B, atau C? **Ketik `pwd` dan `ls`, lalu screenshot dan kirim ke chat!***

---

## 5. Fase 2: Bikin Database Neon dari Terminal & Amankan `.env.local`

### 1. Buat Project Database Baru di Neon Cloud
*(Ganti `nama-db-kamu` dengan nama projekmu, huruf kecil tanpa spasi)*:
```bash
npx neonctl projects create --name nama-db-kamu
```

### 2. Ambil Connection String Database
```bash
npx neonctl connection-string
```
Terminal akan menampilkan link panjang diawali `postgresql://...` dan diakhiri `?sslmode=require`.

### 3. Simpan ke File `.env.local` (Cara Aman Anti-Error Encoding Windows!)
> ⚠️ **Catatan Penting Pengguna Windows:** Jangan pakai `echo ... > .env.local` di PowerShell biasa karena sering merusak format teks (UTF-16) sehingga gagal terbaca Next.js!

Gunakan perintah aman ini di PowerShell *(ganti teks di dalam tanda kutip dengan link dari langkah 2)*:
```powershell
'DATABASE_URL="PASTE_CONNECTION_STRING_NEON_DISINI"' | Set-Content -Path .env.local -Encoding utf8
```
*(Atau cara termudah: copy link `postgresql://...` tadi, paste ke chat, dan bilang ke ZettBOT: **"Masukin connection string Neon ini ke file `.env.local`"**).*

### 4. Pastikan File `.env.local` Aman dari GitHub!
Buka atau minta AI cek file `.gitignore` dan pastikan baris `.env*` sudah ada di dalamnya, agar password databasemu **tidak ikut ter-upload ke GitHub publik**.

---

## 6. Fase 3: Setup Drizzle ORM & Auto-Push Skema ke Neon

Kita memakai **Drizzle ORM** agar sinkronisasi tabel dari kode langsung ke cloud Neon berjalan dalam hitungan detik.

### 1. Install Drizzle & Driver Neon
```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit dotenv
```

### 2. Buat 3 File Koneksi & Konfigurasi Dasar
*(Kamu bisa minta ZettBOT langsung yang membuatkan ke-3 file di bawah ini secara otomatis!)*

- **File 1: `drizzle.config.ts`** (di root folder project):
  ```typescript
  import { defineConfig } from "drizzle-kit";
  import * as dotenv from "dotenv";

  dotenv.config({ path: ".env.local" });

  export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
      url: process.env.DATABASE_URL!,
    },
  });
  ```

- **File 2: `src/db/index.ts`**:
  ```typescript
  import { neon } from "@neondatabase/serverless";
  import { drizzle } from "drizzle-orm/neon-http";
  import * as schema from "./schema";

  const sql = neon(process.env.DATABASE_URL!);
  export const db = drizzle(sql, { schema });
  ```

- **File 3: `src/db/schema.ts`** (Contoh awal tabel `notes`):
  ```typescript
  import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

  export const notesTable = pgTable("notes", {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  });
  ```

### 3. Auto-Push Skema ke Cloud Neon! 🚀
Jalankan perintah ini di terminal:
```bash
npx drizzle-kit push
```
Jika berhasil, terminal akan menampilkan `[i] Applying changes... [✓] Changes applied`. Artinya tabelmu sudah **LIVE di database Neon** tanpa perlu buka dashboard website Neon!

*(Opsional: Ingin melihat isi database lewat tampilan tabel GUI lokal? Ketik `npx drizzle-kit studio`)*.

---

## 7. Fase 4: Bangun Aplikasi (`/zettbot` Mode vs Latihan Tes Koneksi)

Di titik ini, fondasi **Next.js + Neon PostgreSQL** kamu sudah 100% terhubung! Pilih jalurmu:

### 🎯 Jalur Utama (Bikin Aplikasi Beneran Bareng `/zettbot`)
Jika kamu ingin langsung membuat aplikasimu sendiri (misal: Web Kasir, SaaS, Manajemen Inventaris, Booking, dll):
1. Ketik **`/zettbot`** di chat Antigravity (jika belum aktif).
2. Ikuti sesi wawancara PRD bersama ZettBOT hingga `prd.md` disetujui (**`OKE TERAPKAN`**).
3. ZettBOT akan merancang skema tabel asli projekmu di `src/db/schema.ts`, lalu mendorongnya ke Neon dengan `npx drizzle-kit push`, serta membangun UI berkualitas standar Zettbos.

### 🧪 Jalur Latihan (Hanya Ingin Tes Koneksi Jalan atau Tidak)
Jika kamu baru belajar dan ingin mengetes apakah Next.js bisa menyimpan data ke Neon, ganti isi `src/app/page.tsx` dengan kode ini:
```tsx
import { db } from "@/db";
import { notesTable } from "@/db/schema";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic"; // Wajib agar data selalu fresh & aman saat build

export default async function Home() {
  const notes = await db.select().from(notesTable);

  async function createNote(formData: FormData) {
    "use server";
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;

    if (!title || !content) return;

    await db.insert(notesTable).values({ title, content });
    revalidatePath("/");
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Catatan Neon Postgres (Zettbos Test)</h1>

      <form action={createNote} className="flex flex-col gap-3 border p-4 rounded-lg">
        <input name="title" placeholder="Judul..." className="border p-2 rounded" required />
        <textarea name="content" placeholder="Isi catatan..." className="border p-2 rounded" required />
        <button type="submit" className="bg-slate-900 text-white py-2 rounded hover:bg-slate-700">
          Simpan ke Neon
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="font-semibold text-lg">Daftar Catatan dari DB:</h2>
        {notes.length === 0 && <p className="text-gray-500">Belum ada data.</p>}
        {notes.map((n) => (
          <div key={n.id} className="border p-3 rounded bg-gray-50">
            <h3 className="font-bold">{n.title}</h3>
            <p className="text-sm text-gray-700">{n.content}</p>
            <span className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
```
Tes lokal dengan:
```bash
npm run dev
```
Buka `http://localhost:3000` di browser dan coba input 1 data. Jika muncul setelah halaman disimpan, berarti koneksi DB 100% sukses! Tekan **`Ctrl + C`** di terminal jika ingin mematikan server lokal.

---

## 8. Fase 5: Cek Build & Push ke GitHub Tanpa Buka Web

### 1. Wajib Cek Build Lokal (Anti-Gagal Saat Deploy ke Vercel!)
Sebelum upload ke GitHub dan Vercel, pastikan tidak ada error TypeScript atau ESLint tersembunyi:
```bash
npm run build
```
*(Jika sukses tanpa pesan error merah, berarti proyekmu siap diterbangkan ke Vercel!)*

### 2. Simpan & Upload ke GitHub
Jalankan perintah berikut secara berurutan *(ganti `nama-repo-kamu` sesuai nama projekmu)*:
```bash
git init
git add .
git commit -m "feat: initial setup nextjs neon drizzle"
```
Lalu buat repositori baru di GitHub dan langsung push:
```bash
gh repo create nama-repo-kamu --public --source=. --remote=origin --push
```
*(Mau repo pribadi yang tidak bisa dilihat orang lain? Ganti `--public` menjadi `--private`).*

> 📸 *Error saat `npm run build` atau `gh repo create`? **Screenshot terminalnya dan kirim ke chat sekarang!***

---

## 9. Fase 6: Deploy ke Vercel via Terminal

### 1. Hubungkan Project ke Vercel
```bash
npx vercel
```
Jawab pertanyaan di terminal:
- *Set up and deploy?* → Ketik **Y** (Enter)
- *Which scope?* → Pilih akunmu (Enter)
- *Link to existing project?* → Ketik **N** (Enter)
- *What's your project's name?* → Tekan **Enter** (pakai nama default)
- *In which directory is your code located?* → Tekan **Enter** (`./`)
- *Want to modify settings?* → Ketik **N** (Enter)

### 2. Daftarkan `DATABASE_URL` ke Server Vercel
Aplikasi di Vercel butuh alamat database Neon-mu. Jalankan:
```bash
npx vercel env add DATABASE_URL production
```
- Jika diminta memasukkan value: **Paste connection string Neon kamu**, lalu tekan Enter.
- Jika ditanya environment lain atau sensitivitas, ikuti instruksi di layar atau tekan Enter.

*(Tips: Agar URL Preview Vercel juga bisa akses database, ulangi juga untuk preview jika perlu: `npx vercel env add DATABASE_URL preview`).*

### 3. Deploy ke Production (LIVE!)
```bash
npx vercel --prod
```
Tunggu ~30–60 detik. Terminal akan mencetak link produksi seperti `https://nama-projek.vercel.app`.  
Buka link tersebut di HP atau Laptop—**aplikasimu sudah resmi LIVE online!** 🎉

---

## 10. Fase 7: Trik Otomasi "Auto-Migrate Saat Git Push"

Setiap kali kamu mengubah struktur tabel database di masa depan dan melakukan `git push`, kamu bisa membuat Vercel **otomatis mengupdate database Neon** sebelum membangun website.

Di file `package.json`, ubah baris `"build"` menjadi:
```json
"scripts": {
  "dev": "next dev",
  "build": "drizzle-kit push --force && next build",
  "start": "next start",
  "lint": "next lint"
}
```
> [!CAUTION]
> **Aturan ZettBOT (Non-Destruktif):**  
> Fitur `--force` langsung mengeksekusi perubahan skema ke database produksi. Jangan pernah sembarangan menghapus nama kolom atau tabel yang sudah berisi data penting milik user tanpa backup atau migrasi bertahap!

Setelah itu, setiap kali ada update fitur atau kode baru, kamu cukup jalankan 3 baris sakti ini di terminal:
```bash
git add .
git commit -m "update fitur baru"
git push
```
Vercel otomatis mengambil kode baru dari GitHub, menyinkronkan skema ke Neon, dan merilis versi terbaru websitemu!

---

## 11. Troubleshooting Pemula & Solusi Error Umum

| Masalah / Error | Penyebab Umum | Solusi Cepat |
| :--- | :--- | :--- |
| **`running scripts is disabled` (Merah di PowerShell)** | Kebijakan keamanan bawaan Windows memblokir `npm`/`npx` | Jalankan `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` lalu pilih `Y`. |
| **`Author identity unknown` saat `git commit`** | Git belum kenal nama & email kamu | Jalankan `git config --global user.name "Nama"` dan `git config --global user.email "email@gmail.com"`. |
| **`The directory contains files that could conflict`** | Ada file `.md` / `ZettBOT.md` di dalam folder sebelum install Next.js | Minta AI ZettBOT memindahkan file `.md` sementara saat `create-next-app .` berjalan. |
| **`DATABASE_URL is undefined` padahal `.env.local` ada** | File `.env.local` tersimpan dengan format UTF-16 PowerShell | Hapus `.env.local`, lalu minta ZettBOT langsung yang membuatkan file `.env.local`. |
| **Data tidak berubah di website Vercel yang sudah live** | Halaman Next.js ter-cache secara statis saat build | Pastikan ada `export const dynamic = "force-dynamic";` di halaman Server Component yang membaca DB. |

---

> [!TIP]  
> 📷 **Masih Terkendala atau Bingung di Salah Satu Langkah?**  
> Jangan membuang waktu menebak-nebak! **Screenshot terminal atau halaman browser yang error**, lalu kirimkan ke chat Antigravity. ZettBOT siap membantumu menyelesaikannya!

---
**Official Playbook by Zettbos** — *Dibuat khusus untuk Ekosistem Member Zettbos & `/zettbot`.*
