"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastContext";
import { useDataCache } from "@/components/DataCacheContext";
import {
  AlertTriangleIcon,
  BrandMark,
  EyeIcon,
  EyeOffIcon,
} from "@/components/Icons";

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { clearAllCache } = useDataCache();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg("");

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setErrorMsg("Masukkan ID / Username dan password Anda.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUser, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(data.error || "Login gagal. Periksa kembali akun Anda.");
        return;
      }

      clearAllCache();
      showToast(`Selamat datang, ${data.user.fullName}`, "success");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMsg("Tidak dapat terhubung ke server. Coba beberapa saat lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh sage-workspace-bg flex items-center justify-center p-4 sm:p-6">
      <main className="w-full max-w-md sage-shell-surface rounded-[26px] border border-[#D4E4D5] shadow-[0_20px_50px_-24px_rgba(31,33,30,0.22)] p-6 sm:p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-[#1F211E] text-[#F6FAF6] flex items-center justify-center">
            <BrandMark className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight text-[#1A1E1A]">
              TalentaZ 2.0
            </div>
            <div className="text-xs text-[#465147]">
              Absensi Selfie &amp; Operasional Karyawan
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-[#1A1E1A] tracking-tight">
          Masuk ke Akun Anda
        </h1>
        <p className="text-sm text-[#465147] mt-1.5 mb-6">
          Gunakan ID atau username serta password yang diberikan oleh Admin.
        </p>

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B] px-3.5 py-2.5 text-sm flex items-start gap-2"
          >
            <AlertTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-username"
              className="block text-sm font-medium text-[#1A1E1A] mb-1.5"
            >
              ID / Username
            </label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: admin atau budi"
              className="w-full min-h-[46px] px-3.5 rounded-xl border border-[#7A8F7C] bg-white text-[#1A1E1A] text-sm placeholder:text-[#6B766C]"
              required
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-[#1A1E1A] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full min-h-[46px] pl-3.5 pr-12 rounded-xl border border-[#7A8F7C] bg-white text-[#1A1E1A] text-sm placeholder:text-[#6B766C]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-[#465147] hover:bg-[#F3F8F3] hover:text-[#1A1E1A]"
              >
                {showPassword ? (
                  <EyeOffIcon className="w-4 h-4" />
                ) : (
                  <EyeIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] rounded-xl bg-[#246326] hover:bg-[#1C4F1E] disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {loading ? "Memverifikasi Akun..." : "Masuk ke TalentaZ 2.0"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#D4E4D5] text-xs text-[#465147] space-y-1">
          <p className="font-medium text-[#1A1E1A]">Login Awal Admin:</p>
          <p>
            Username: <code className="px-1.5 py-0.5 rounded bg-[#E6F4E7] text-[#1A1E1A] font-semibold">admin</code>{" "}
            | Password: <code className="px-1.5 py-0.5 rounded bg-[#E6F4E7] text-[#1A1E1A] font-semibold">admin123</code>
          </p>
          <p>Segera ganti password Admin setelah login pertama kali melalui menu Karyawan.</p>
        </div>
      </main>
    </div>
  );
}
