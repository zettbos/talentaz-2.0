# DESIGN.md: TalentaZ 2.0

> Direction extracted from user visual reference (`Crextio`-style Mint-Sage & Charcoal Bento UI) and project requirements. Treated as design data for `antislop` DURING mode.

## 1. Identity & Design Read
- **Product:** TalentaZ 2.0 (Web App Absensi Selfie, GPS Radius, Izin/Cuti, Lembur, Potong Gaji & Rekap PDF/Excel)
- **Audience:** Karyawan (akses utama lewat browser HP untuk absen cepat & pengajuan) dan Admin/Atasan (akses utama lewat browser Laptop/Desktop untuk monitoring harian, persetujuan, peta lokasi, dan rekap penggajian)
- **Design Read:** Reading this as: operational HR & attendance web app for karyawan and admin/atasan, in a Mint-Sage & Charcoal Glass Bento style derived from the user reference, dial ENERGY 2 / RHYTHM 3 / MOTION 1.
- **Identity Motif:** High-contrast dark charcoal action cards (`#1F211E`) and dark active navigation pills paired against soft mint-sage work surfaces (`#EAF4EA`), punctuated by a single leaf-emerald progress accent (`#246326` / `#347F2F`).

## 2. Three Dials (Part 3 Liveliness)
- **ENERGY: 2 (Balanced):** Confident, crisp operational clarity. Clear visual hierarchy with one dominant focal action per viewport (Karyawan: Selfie Clock-In/Out; Admin: Daily Attendance & Pending Approvals).
- **RHYTHM: 3 (Varied):** Intentional composition shifts between regions rather than identical uniform card grids. On desktop, asymmetric 3-column Bento proportions (profile + accordions on left, stacked charts + weekly timeline in center, dark charcoal approval checklist on right); on mobile, thumb-first camera/attendance action card followed by compact 2-column KPI grid and chronological activity list.
- **MOTION: 1 (Calm):** Purposeful hover, focus, and accordion/drawer state transitions (`150ms-200ms ease`) only. No endless pulsing dots, floating cards, or decorative bounce animations. All non-essential motion disabled under `prefers-reduced-motion: reduce`.

## 3. Color Palette (2 Core + 1 Accent, WCAG AA Verified)
- **Core 1 (Canvas & Mint-Sage Atmosphere):**
  - Outer gradient frame: `#CBE8CC` to `#E6F4E7` (soft sage wash defining the workspace canvas, matching user reference)
  - Elevated surface white: `#FFFFFF` (primary data cards & forms)
  - Soft sage secondary surface: `#F3F8F3` (nested tiles, metric tracks, accordion headers)
  - Subtle hairline border: `#D4E4D5`
  - Interactive input border (non-text 3:1 AA verified): `#7A8F7C`
- **Core 2 (Charcoal Ink & Contrast Panels):**
  - Primary dark surface & active pill: `#1F211E` (checklist/approval hero panel & active navigation tab)
  - Primary body text on light: `#1A1E1A` (contrast > 14:1)
  - Secondary label text on light: `#465147` (contrast > 7:1, strictly avoiding low-contrast light-grey text)
  - Primary text on `#1F211E` dark panel: `#F6FAF6`
  - Secondary text on `#1F211E` dark panel: `#C4D0C4`
- **Single Deliberate Accent (Leaf Emerald):**
  - Primary interactive button / readable white-on-green badge background: `#246326` (hover `#1C4F1E`, white text contrast > 6.4:1 AA)
  - Chart progress bar & SVG completion ring fill: `#347F2F` (non-text UI contrast 4.41:1 against `#EAF4EA` track and 4.97:1 against `#FFFFFF`)
- **Semantic Status (Used Only with Text + Icon, Never Color Alone):**
  - Tepat Waktu / Disetujui: `#246326` on `#E6F4E7`
  - Terlambat / Luar Radius / Menunggu: `#92400E` on `#FEF3C7`
  - Ditolak / Alpha / Potongan: `#991B1B` on `#FEE2E2`

## 4. Typography
- **Primary Typeface:** `Plus Jakarta Sans` (loaded via `next/font/google`) for crisp Indonesian legibility, friendly modern geometric proportions matching the reference UI, and clean numeric rendering with `font-variant-numeric: tabular-nums` for clocks, salaries, late minutes, and meter distances.
- **Hierarchy:**
  - Page Greeting / Hero Heading (`<h1>`): fluid `clamp(1.5rem, 2.5vw, 2.125rem)`, weight `600`, tight tracking (`-0.02em`).
  - Big KPI Counter Numbers: `clamp(1.75rem, 2.8vw, 2.35rem)`, weight `500`, `tabular-nums`.
  - Section / Card Headings (`<h2>` / `<h3>`): `1rem` to `1.125rem`, weight `600`.
  - Body & Table Cells: `0.875rem` (`14px`) desktop, fluid compact scale on mobile (`13px`) without horizontal overflow.

## 5. Radius, Elevation & Glassmorphism Guardrails
- **Radius Hierarchy (No Pill-Everything):**
  - Main outer app frame (desktop): `rounded-[28px]`
  - Dashboard Bento Cards: `rounded-[22px]` (`22px`)
  - Form inputs, modal panels, table containers, photo preview frames: `rounded-xl` (`12px`)
  - Navigation tabs & real status indicators: `rounded-full` (only for nav capsules and compact status badges)
- **Glassmorphism Dose Cap (Max 1-2 Elements):**
  - Applied ONLY to the top floating navigation shell (`bg-white/75 backdrop-blur-md`) and modal backdrop overlay. Cards inside the grid use solid or clean opaque surfaces (`#FFFFFF`, `#F3F8F3`, `#1F211E`) for crisp text readability.
- **Shadow Discipline:**
  - Cards sit largely flat with crisp `1px` borders (`#D4E4D5`); only primary floating panels (navbar shell & active popovers/modals) use restrained soft elevation shadows.

## 6. Iconography & Media Integrity
- **Custom Purpose-Built Inline SVG Icons:** Clean 1.75px stroke geometric SVGs specific to attendance, camera capture, map pin radius, approval checkmark, payroll deduction, and PDF/Excel export. Zero decorative emoji in headings, tabs, or buttons.
- **Real User Data Only:** Zero hardcoded numbers, zero fake testimonials, zero invented placeholder profiles. New accounts without a photo display deterministic initials avatars; KPIs and charts reflect real PostgreSQL database totals or explicit empty states with clear next actions.

## 7. Multi-Breakpoint Responsive Reflow
- **Mobile (`< 768px`, Karyawan-First):**
  - Single-column thumb-friendly stack (`16px` horizontal gutter).
  - Compact header with brand mark, user role pill, and account menu.
  - Focal action right at the top: live clock + office radius status + primary `Absen Masuk / Pulang` button opening the browser camera & GPS capture flow.
  - 2-column compact KPI summary grid (Hadir, Telat/Potongan) without vertical scroll fatigue.
  - Fixed bottom navigation bar (`44px+` tap targets, proper bottom padding so content never gets covered) showing 4 primary menus + `Lainnya` drawer for remaining sections.
- **Tablet & Small Laptop (`768px - 1179px`, Intermediate State):**
  - 2-column adaptive Bento layout (`Profile & Time Tracker` paired top, `Weekly Progress` & `Approvals` side by side below) with collapsible top nav links so nothing crowds or clips.
- **Desktop (`>= 1180px`, Monitoring Console matching Reference):**
  - Floating top pill navbar (`TalentaZ 2.0` left, active charcoal pill center, Setting/Notif/Profil icons right).
  - Greeting + horizontal progress pills on left, 3 large real-time KPI counters on right.
  - 3-column asymmetric Bento dashboard grid mirroring the visual proportions of the reference image (`26% / 48% / 26%`):
    - Left column: Employee/Admin profile card with real photo/initials & net salary/status badge + collapsible info accordions (`Shift & Lokasi`, `Ringkasan Gaji`, `Potongan & Lembur`).
    - Center-top split: Weekly Work Hours Progress bar chart + Circular Time Tracker gauge with interactive Clock-In/Out controls.
    - Center-bottom: Attendance & Shift Calendar / Timeline strip.
    - Right column: Monthly Attendance/Target split progress bar + Dark Charcoal (`#1F211E`) Pending Approvals & Daily Checklist card.
