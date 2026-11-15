import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ToastContext";
import { DataCacheProvider } from "@/components/DataCacheContext";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "TalentaZ 2.0 | Absensi Selfie & Monitoring Karyawan",
  description:
    "Aplikasi absensi selfie dan lokasi GPS karyawan dengan persetujuan izin, lembur, potongan telat, dan laporan PDF Kop Surat serta Excel.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${plusJakarta.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[#1A1E1A] bg-[#D9EEDB] selection:bg-[#246326] selection:text-white">
        <ToastProvider>
          <DataCacheProvider>{children}</DataCacheProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
