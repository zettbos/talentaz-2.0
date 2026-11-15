"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { SafeUser } from "@/lib/auth";
import { compressLogoOrAvatar } from "@/lib/media-client";
import {
  DEFAULT_SETTINGS_FORM,
  normalizeCompanySettings,
  type SettingsFormState,
} from "@/lib/settings-defaults";
import { formatRupiah } from "@/lib/time";
import { useProtectedShell, useSyncShellMeta } from "./ProtectedShellContext";
import { useDataCache } from "./DataCacheContext";
import { useToast } from "./ToastContext";
import { MapPinIcon, SlidersIcon, UploadIcon } from "./Icons";

const LeafletPicker = dynamic(() => import("@/components/LeafletPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-72 rounded-2xl bg-[#EAF4EA] animate-pulse flex items-center justify-center text-xs text-[#465147]">
      Memuat peta Leaflet...
    </div>
  ),
});

export function PengaturanClient({
  initialUser: initialUserProp,
}: {
  initialUser?: SafeUser;
}) {
  const router = useRouter();
  const { user: shellUser } = useProtectedShell();
  const initialUser = initialUserProp ?? shellUser;
  const { getCached, setCached, invalidatePrefix, cacheVersion } = useDataCache();
  const { showToast } = useToast();

  useEffect(() => {
    if (initialUser.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [initialUser.role, router]);

  const [form, setForm] = useState<SettingsFormState>(() => {
    const cached = getCached<SettingsFormState>("settings");
    return cached ?? DEFAULT_SETTINGS_FORM;
  });
  const [loading, setLoading] = useState<boolean>(() => !getCached("settings"));
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [locatingSelf, setLocatingSelf] = useState(false);

  const fetchSettingsNow = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat pengaturan.");
      }
      if (json.settings) {
        const normalized = normalizeCompanySettings(
          json.settings as Record<string, unknown>
        );
        setCached("settings", normalized);
        setForm(normalized);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Gagal memuat pengaturan."
      );
    } finally {
      setLoading(false);
    }
  }, [setCached]);

  useEffect(() => {
    let cancelled = false;
    const cached = getCached<SettingsFormState>("settings");
    if (cached) {
      queueMicrotask(() => {
        if (!cancelled) {
          setForm(cached);
          setLoading(false);
          setErrorMsg("");
        }
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setErrorMsg("");
      }
    });

    fetch("/api/settings", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Gagal memuat pengaturan.");
        }
        if (cancelled) return;
        if (json.settings) {
          const normalized = normalizeCompanySettings(
            json.settings as Record<string, unknown>
          );
          setCached("settings", normalized);
          setForm(normalized);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error ? err.message : "Gagal memuat pengaturan."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheVersion, getCached, setCached]);

  function handleUseCurrentLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      showToast("Browser Anda tidak mendukung GPS.", "error");
      return;
    }
    setLocatingSelf(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          officeLat: Number(pos.coords.latitude.toFixed(6)),
          officeLng: Number(pos.coords.longitude.toFixed(6)),
        }));
        setLocatingSelf(false);
        showToast("Koordinat kantor dipindahkan ke posisi Anda saat ini.", "info");
      },
      () => {
        setLocatingSelf(false);
        showToast(
          "Gagal membaca lokasi GPS saat ini. Pastikan izin lokasi aktif.",
          "error"
        );
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressLogoOrAvatar(file, 300, true);
      setForm((prev) => ({ ...prev, logoDataUrl: dataUrl }));
      showToast("Logo kop surat siap disimpan.", "info");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal memproses file logo.",
        "error"
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan pengaturan.");
      }

      if (json.settings) {
        setCached("settings", json.settings as SettingsFormState);
      }
      invalidatePrefix("settings");
      invalidatePrefix("dashboard");
      invalidatePrefix("attendances");
      invalidatePrefix("reports");
      invalidatePrefix("overtimes");
      showToast("Pengaturan lokasi, jam kerja, dan kop surat disimpan.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal menyimpan pengaturan.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  useSyncShellMeta({
    companyName: form.companyName,
    onRefresh: () => {
      invalidatePrefix("settings");
      void fetchSettingsNow();
    },
  });

  if (initialUser.role !== "admin") {
    return null;
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1E1A]">
              Pengaturan Lokasi Kantor, Jam Kerja & Kop Surat
            </h1>
            <p className="text-xs sm:text-sm text-[#465147] mt-0.5">
              Geser pin peta Leaflet untuk menentukan titik kantor, atur batas radius GPS, nominal potongan telat, dan kop surat PDF.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving || loading}
            className="min-h-[46px] px-6 rounded-full bg-[#246326] text-white text-sm font-bold hover:bg-[#1b4e1d] disabled:opacity-50 self-start sm:self-auto"
          >
            {saving ? "Menyimpan..." : "Simpan Semua Pengaturan"}
          </button>
        </section>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 h-96 rounded-[28px] bg-white/80 animate-pulse" />
            <div className="lg:col-span-5 h-96 rounded-[28px] bg-white/80 animate-pulse" />
          </div>
        ) : errorMsg ? (
          <div className="rounded-[28px] bg-[#FEE2E2] p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-[#991B1B]">{errorMsg}</p>
            <button
              type="button"
              onClick={() => void fetchSettingsNow()}
              className="min-h-[42px] px-5 rounded-full bg-[#991B1B] text-white text-xs font-semibold"
            >
              Muat Ulang Pengaturan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Interactive Leaflet Map & Radius */}
            <section className="lg:col-span-7 rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1A1E1A] flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 text-[#246326]" />
                    <span>Titik Lokasi & Radius Kantor (Leaflet.js)</span>
                  </h2>
                  <p className="text-xs text-[#465147]">
                    Klik langsung di peta atau seret pin untuk memindahkan titik pusat absensi.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={locatingSelf}
                  onClick={handleUseCurrentLocation}
                  className="min-h-[40px] px-4 rounded-full bg-[#1F211E] text-[#F6FAF6] text-xs font-semibold hover:bg-black disabled:opacity-50"
                >
                  {locatingSelf ? "Mendeteksi..." : "Gunakan Lokasi Saya"}
                </button>
              </div>

              <LeafletPicker
                lat={form.officeLat}
                lng={form.officeLng}
                radiusMeters={form.radiusMeters}
                interactive={true}
                heightClass="h-72 sm:h-80"
                onChangeLocation={(lat, lng) =>
                  setForm((prev) => ({ ...prev, officeLat: lat, officeLng: lng }))
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="set-lat"
                    className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                  >
                    Latitude Kantor
                  </label>
                  <input
                    id="set-lat"
                    type="number"
                    step="0.000001"
                    required
                    value={form.officeLat}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        officeLat: Number(e.target.value),
                      }))
                    }
                    className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A] tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="set-lng"
                    className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                  >
                    Longitude Kantor
                  </label>
                  <input
                    id="set-lng"
                    type="number"
                    step="0.000001"
                    required
                    value={form.officeLng}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        officeLng: Number(e.target.value),
                      }))
                    }
                    className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A] tabular-nums"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-[#F3F8F3] border border-[#DCEADC] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="set-radius-range"
                    className="text-xs sm:text-sm font-bold text-[#1A1E1A]"
                  >
                    Radius Toleransi Absensi: {form.radiusMeters} meter
                  </label>
                  <input
                    id="set-radius-number"
                    type="number"
                    min={10}
                    max={50000}
                    aria-label="Radius meter numerik"
                    value={form.radiusMeters}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        radiusMeters: Math.max(10, Number(e.target.value) || 10),
                      }))
                    }
                    className="w-24 min-h-[36px] rounded-xl border border-[#7A8F7C] bg-white px-2.5 text-xs font-semibold text-[#1A1E1A] tabular-nums text-right"
                  />
                </div>
                <input
                  id="set-radius-range"
                  type="range"
                  min={20}
                  max={2000}
                  step={10}
                  value={Math.min(2000, form.radiusMeters)}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      radiusMeters: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-[#246326]"
                />
                <div className="flex justify-between text-[11px] text-[#465147] tabular-nums">
                  <span>20 m (ketat)</span>
                  <span>1.000 m</span>
                  <span>2.000 m (area luas)</span>
                </div>
              </div>
            </section>

            {/* Right: Jam Kerja, Potongan, Lembur & Kop Surat */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              {/* Work Hours & Payroll Rules */}
              <section className="rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-4">
                <h2 className="text-base sm:text-lg font-bold text-[#1A1E1A] flex items-center gap-2">
                  <SlidersIcon className="w-4 h-4 text-[#246326]" />
                  <span>Jam Kerja, Potongan Telat & Tarif Lembur</span>
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="set-start-time"
                      className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                    >
                      Jam Masuk (WIB)
                    </label>
                    <input
                      id="set-start-time"
                      type="time"
                      required
                      value={form.workStartTime}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          workStartTime: e.target.value,
                        }))
                      }
                      className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3 text-sm text-[#1A1E1A]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="set-end-time"
                      className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                    >
                      Jam Pulang (WIB)
                    </label>
                    <input
                      id="set-end-time"
                      type="time"
                      required
                      value={form.workEndTime}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          workEndTime: e.target.value,
                        }))
                      }
                      className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3 text-sm text-[#1A1E1A]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="set-grace"
                    className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                  >
                    Toleransi Keterlambatan (menit)
                  </label>
                  <input
                    id="set-grace"
                    type="number"
                    min={0}
                    max={180}
                    required
                    value={form.lateGraceMinutes}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        lateGraceMinutes: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A] tabular-nums"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="set-penalty"
                      className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                    >
                      Potongan / Telat (Rp)
                    </label>
                    <input
                      id="set-penalty"
                      type="number"
                      min={0}
                      required
                      value={form.latePenaltyAmount}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          latePenaltyAmount: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A] tabular-nums"
                    />
                    <span className="text-[11px] text-[#465147] mt-0.5 block">
                      Saat ini: {formatRupiah(form.latePenaltyAmount)}
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="set-overtime-rate"
                      className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                    >
                      Tarif Lembur / Jam (Rp)
                    </label>
                    <input
                      id="set-overtime-rate"
                      type="number"
                      min={0}
                      required
                      value={form.overtimeHourlyRate}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          overtimeHourlyRate: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A] tabular-nums"
                    />
                    <span className="text-[11px] text-[#465147] mt-0.5 block">
                      Saat ini: {formatRupiah(form.overtimeHourlyRate)}/jam
                    </span>
                  </div>
                </div>
              </section>

              {/* Kop Surat PDF Dynamic Editor */}
              <section className="rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-3.5">
                <h2 className="text-base sm:text-lg font-bold text-[#1A1E1A]">
                  Kop Surat Laporan PDF
                </h2>

                <div>
                  <label
                    htmlFor="set-company"
                    className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                  >
                    Nama Perusahaan / Instansi
                  </label>
                  <input
                    id="set-company"
                    type="text"
                    required
                    value={form.companyName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        companyName: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="set-tagline"
                    className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                  >
                    Subjudul / Divisi
                  </label>
                  <input
                    id="set-tagline"
                    type="text"
                    value={form.companyTagline}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        companyTagline: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="set-address"
                    className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                  >
                    Alamat Lengkap
                  </label>
                  <input
                    id="set-address"
                    type="text"
                    required
                    value={form.companyAddress}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        companyAddress: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="set-contact"
                    className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                  >
                    Kontak (Telp / Email / Website)
                  </label>
                  <input
                    id="set-contact"
                    type="text"
                    value={form.companyContact}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        companyContact: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="set-leader-name"
                      className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                    >
                      Nama Penandatangan
                    </label>
                    <input
                      id="set-leader-name"
                      type="text"
                      required
                      value={form.leaderName}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          leaderName: e.target.value,
                        }))
                      }
                      className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3 text-xs sm:text-sm text-[#1A1E1A]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="set-leader-title"
                      className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                    >
                      Jabatan Penandatangan
                    </label>
                    <input
                      id="set-leader-title"
                      type="text"
                      required
                      value={form.leaderTitle}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          leaderTitle: e.target.value,
                        }))
                      }
                      className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3 text-xs sm:text-sm text-[#1A1E1A]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F5FAF5] border border-[#DCEADC] p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {form.logoDataUrl ? (
                      <img
                        src={form.logoDataUrl}
                        alt="Logo Kop Surat"
                        width={44}
                        height={44}
                        className="w-11 h-11 rounded-xl object-contain bg-white border border-[#DCEADC] shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-[#DCEADC] text-[#1A1E1A] flex items-center justify-center text-xs font-bold shrink-0">
                        LOGO
                      </div>
                    )}
                    <span className="text-xs text-[#465147] truncate">
                      Logo Kop Surat (PNG/JPG)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {form.logoDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, logoDataUrl: null }))
                        }
                        className="min-h-[36px] px-3 rounded-full bg-[#FEE2E2] text-[#991B1B] text-xs font-semibold"
                      >
                        Hapus
                      </button>
                    )}
                    <label
                      htmlFor="set-logo-input"
                      className="min-h-[36px] px-3.5 rounded-full bg-white border border-[#7A8F7C] text-xs font-semibold text-[#1A1E1A] inline-flex items-center gap-1"
                    >
                      <UploadIcon className="w-3.5 h-3.5" />
                      <span>Unggah</span>
                    </label>
                    <input
                      id="set-logo-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleLogoUpload(e)}
                      className="sr-only"
                    />
                  </div>
                </div>

                {/* Live Mini Preview of Kop Surat */}
                <div className="rounded-2xl bg-white border border-[#1F211E]/20 p-3.5 text-center space-y-1">
                  <div className="flex items-center justify-center gap-3">
                    {form.logoDataUrl && (
                      <img
                        src={form.logoDataUrl}
                        alt="Preview logo"
                        width={36}
                        height={36}
                        className="w-9 h-9 object-contain"
                      />
                    )}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#1A1E1A]">
                        {form.companyName}
                      </p>
                      <p className="text-[11px] text-[#465147]">
                        {form.companyTagline}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#465147]">
                    {form.companyAddress} | {form.companyContact}
                  </p>
                  <div className="border-t-2 border-b border-[#1A1E1A] h-1" />
                </div>
              </section>
            </div>
          </div>
        )}
      </form>
    </>
  );
}
