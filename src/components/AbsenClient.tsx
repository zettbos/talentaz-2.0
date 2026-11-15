"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { SafeUser } from "@/lib/auth";
import { haversineMeters } from "@/lib/geo";
import { captureWatermarkedSelfie } from "@/lib/media-client";
import {
  computeLateStatus,
  formatRupiah,
  formatWibTimeShort,
  getWibParts,
} from "@/lib/time";
import { useCachedQuery } from "@/lib/use-cached-query";
import { useProtectedShell, useSyncShellMeta } from "./ProtectedShellContext";
import { useDataCache } from "./DataCacheContext";
import { useToast } from "./ToastContext";
import { Modal } from "./Modal";
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  MapPinIcon,
  RefreshIcon,
} from "./Icons";

const LeafletPicker = dynamic(() => import("@/components/LeafletPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-56 sm:h-64 rounded-2xl bg-[#EAF4EA] animate-pulse flex items-center justify-center text-xs text-[#465147]">
      Memuat peta lokasi kantor...
    </div>
  ),
});

interface AttendanceSettings {
  companyName: string;
  officeLat: number;
  officeLng: number;
  radiusMeters: number;
  workStartTime: string;
  workEndTime: string;
  lateGraceMinutes: number;
  latePenaltyAmount: number;
}

interface AttendanceRecordRow {
  id: number;
  attendanceCode: string;
  workDate: string;
  userId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInTime: string;
  clockOutTime: string;
  clockInPhoto: string | null;
  clockOutPhoto: string | null;
  clockInDistanceMeters: number | null;
  clockOutDistanceMeters: number | null;
  isLate: boolean;
  lateMinutes: number;
  lateReason: string | null;
  isOutsideIn: boolean;
  outsideInReason: string | null;
  isOutsideOut: boolean;
  outsideOutReason: string | null;
  penaltyAmount: number;
}

interface TodayRawRecord {
  id: number;
  attendanceCode: string;
  workDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInPhoto: string | null;
  clockOutPhoto: string | null;
  clockInDistanceMeters: number | null;
  clockOutDistanceMeters: number | null;
  isLate: boolean;
  lateMinutes: number;
  isOutsideIn: boolean;
  isOutsideOut: boolean;
  penaltyAmount: number;
}

interface AttendanceListPayload {
  today: TodayRawRecord | null;
  settings: AttendanceSettings | null;
  records: AttendanceRecordRow[];
  total: number;
  page: number;
  totalPages: number;
}

export function AbsenClient({
  initialUser: initialUserProp,
}: {
  initialUser?: SafeUser;
}) {
  const { user: shellUser } = useProtectedShell();
  const initialUser = initialUserProp ?? shellUser;
  const { invalidatePrefix } = useDataCache();
  const { showToast } = useToast();

  // Filter & pagination state.
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);

  const queryString = useMemo(
    () =>
      new URLSearchParams({
        q,
        status: statusFilter,
        date: dateFilter,
        page: String(page),
        limit: "10",
      }).toString(),
    [dateFilter, page, q, statusFilter]
  );

  const cacheKey = useMemo(
    () => `attendances:q=${q}&s=${statusFilter}&d=${dateFilter}&p=${page}`,
    [dateFilter, page, q, statusFilter]
  );

  const {
    data: payload,
    loading,
    errorMsg,
    refetch: loadAttendances,
  } = useCachedQuery<AttendanceListPayload>(
    cacheKey,
    `/api/attendances?${queryString}`,
    "Gagal memuat data absensi."
  );

  // Live clock, GPS, and browser camera state.
  const [wibClock, setWibClock] = useState(() => getWibParts());
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState("");

  const [lateReason, setLateReason] = useState("");
  const [outsideReason, setOutsideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [detailRow, setDetailRow] = useState<AttendanceRecordRow | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setWibClock(getWibParts());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const requestGps = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsError("Perangkat atau browser Anda tidak mendukung GPS Geolocation.");
      setGpsLoading(false);
      return;
    }

    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError(
            "Izin lokasi GPS ditolak browser. Aktifkan izin lokasi di pengaturan situs lalu coba lagi."
          );
        } else {
          setGpsError(
            "Gagal mendapatkan sinyal lokasi akurat. Pastikan GPS aktif dan coba ulang."
          );
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  const startCamera = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError(
        "Kamera browser tidak didukung pada perangkat atau koneksi non-HTTPS ini."
      );
      return;
    }

    setCameraError("");
    setCameraReady(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraReady(true);
    } catch {
      setCameraError(
        "Akses kamera ditolak atau kamera sedang dipakai aplikasi lain. Izinkan kamera lalu muat ulang."
      );
      setCameraReady(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      requestGps();
      void startCamera();
    });
    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [requestGps, startCamera]);

  const settings = payload?.settings ?? null;
  const today = payload?.today ?? null;

  const isClockedInToday = Boolean(today?.clockInAt);
  const isClockedOutToday = Boolean(today?.clockOutAt);
  const nextAction: "clock_in" | "clock_out" | "done" = !isClockedInToday
    ? "clock_in"
    : !isClockedOutToday
      ? "clock_out"
      : "done";

  const distanceMeters = useMemo(() => {
    if (!settings || userLat === null || userLng === null) return null;
    return haversineMeters(
      userLat,
      userLng,
      settings.officeLat,
      settings.officeLng
    );
  }, [settings, userLat, userLng]);

  const isOutsideRadius = useMemo(() => {
    if (!settings || distanceMeters === null) return false;
    return distanceMeters > settings.radiusMeters;
  }, [distanceMeters, settings]);

  const liveLateStatus = useMemo(() => {
    if (!settings || nextAction !== "clock_in") {
      return { isLate: false, lateMinutes: 0 };
    }
    return computeLateStatus(
      wibClock.minutesSinceMidnight,
      settings.workStartTime,
      settings.lateGraceMinutes
    );
  }, [nextAction, settings, wibClock.minutesSinceMidnight]);

  function handleCaptureSelfie() {
    if (!videoRef.current || !cameraReady) {
      showToast("Kamera belum siap. Aktifkan kamera terlebih dahulu.", "error");
      return;
    }
    if (userLat === null || userLng === null || distanceMeters === null) {
      showToast(
        "Koordinat GPS belum terdeteksi. Perbarui lokasi sebelum memotret.",
        "error"
      );
      return;
    }

    try {
      const dataUrl = captureWatermarkedSelfie(videoRef.current, {
        fullName: initialUser.fullName,
        employeeCode: initialUser.employeeCode,
        timestampText: wibClock.formattedDateTime,
        distanceMeters,
        insideRadius: !isOutsideRadius,
        lat: userLat,
        lng: userLng,
        actionLabel: nextAction === "clock_out" ? "PULANG" : "MASUK",
      });
      setCapturedPhoto(dataUrl);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal mengambil gambar selfie.",
        "error"
      );
    }
  }

  async function handleSubmitAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (nextAction === "done") return;

    if (!capturedPhoto) {
      showToast("Ambil foto selfie terlebih dahulu.", "error");
      return;
    }
    if (userLat === null || userLng === null) {
      showToast("Koordinat GPS wajib tersedia.", "error");
      return;
    }
    if (
      nextAction === "clock_in" &&
      liveLateStatus.isLate &&
      lateReason.trim().length < 5
    ) {
      showToast(
        "Anda tercatat terlambat. Isi alasan terlambat minimal 5 karakter.",
        "error"
      );
      return;
    }
    if (isOutsideRadius && outsideReason.trim().length < 5) {
      showToast(
        "Lokasi Anda di luar radius kantor. Isi alasan minimal 5 karakter.",
        "error"
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/attendances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: nextAction,
          photoDataUrl: capturedPhoto,
          lat: userLat,
          lng: userLng,
          lateReason: lateReason.trim(),
          outsideReason: outsideReason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan absensi.");
      }

      showToast(
        nextAction === "clock_in"
          ? "Absen masuk berhasil dicatat."
          : "Absen pulang berhasil dicatat.",
        "success"
      );
      setCapturedPhoto("");
      setLateReason("");
      setOutsideReason("");
      invalidatePrefix("attendances");
      invalidatePrefix("dashboard");
      invalidatePrefix("reports");
      await loadAttendances();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal mengirim data absensi.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleApplySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  }

  useSyncShellMeta({
    companyName: settings?.companyName ?? "TalentaZ 2.0",
    onRefresh: () => {
      invalidatePrefix("attendances");
      void loadAttendances();
    },
  });

  return (
    <>
      <div className="space-y-6">
        {/* Top Page Title & Live Clock */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1E1A]">
              Absensi Selfie & Validasi Lokasi
            </h1>
            <p className="text-xs sm:text-sm text-[#465147] mt-0.5">
              Kamera langsung dengan watermark WIB, jarak GPS, dan alasan otomatis jika telat atau di luar radius.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#1F211E] text-[#F6FAF6] px-4 py-2 text-xs sm:text-sm font-semibold tabular-nums self-start sm:self-auto">
            <ClockIcon className="w-4 h-4 text-[#68C164]" />
            <span>{wibClock.formattedDateTime}</span>
          </div>
        </section>

        {/* Capture + Map Dual Bento Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Browser Camera & Submission Form */}
          <form
            onSubmit={handleSubmitAttendance}
            className="lg:col-span-6 rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#1A1E1A]">
                  {nextAction === "clock_in"
                    ? "Langkah 1: Absen Masuk"
                    : nextAction === "clock_out"
                      ? "Langkah 2: Absen Pulang"
                      : "Absensi Hari Ini Selesai"}
                </h2>
                <p className="text-xs text-[#465147]">
                  {settings
                    ? `Jam kerja: ${settings.workStartTime} - ${settings.workEndTime} WIB (Toleransi ${settings.lateGraceMinutes} mnt)`
                    : "Memuat aturan jam kerja..."}
                </p>
              </div>
              {today && (
                <span className="px-3 py-1 rounded-full bg-[#E6F4E7] text-[#1D5420] text-xs font-semibold tabular-nums">
                  Masuk {formatWibTimeShort(today.clockInAt)}
                  {today.clockOutAt
                    ? ` | Pulang ${formatWibTimeShort(today.clockOutAt)}`
                    : ""}
                </span>
              )}
            </div>

            {nextAction === "done" ? (
              <div className="rounded-2xl bg-[#F3F8F3] border border-[#D4E4D5] p-5 text-center space-y-3">
                <CheckCircleIcon className="w-10 h-10 text-[#246326] mx-auto" />
                <div>
                  <p className="text-base font-bold text-[#1A1E1A]">
                    Absen Masuk & Pulang Hari Ini Sudah Lengkap
                  </p>
                  <p className="text-xs text-[#465147] mt-1">
                    Kode catatan: {today?.attendanceCode}. Data telah tersimpan ke rekap bulanan.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {today?.clockInPhoto && (
                    <div className="space-y-1">
                      <img
                        src={today.clockInPhoto}
                        alt="Selfie masuk hari ini"
                        width={320}
                        height={240}
                        className="w-full h-32 object-cover rounded-xl border border-[#D4E4D5]"
                      />
                      <span className="block text-[11px] font-medium text-[#465147]">
                        Masuk ({formatWibTimeShort(today.clockInAt)})
                      </span>
                    </div>
                  )}
                  {today?.clockOutPhoto && (
                    <div className="space-y-1">
                      <img
                        src={today.clockOutPhoto}
                        alt="Selfie pulang hari ini"
                        width={320}
                        height={240}
                        className="w-full h-32 object-cover rounded-xl border border-[#D4E4D5]"
                      />
                      <span className="block text-[11px] font-medium text-[#465147]">
                        Pulang ({formatWibTimeShort(today.clockOutAt)})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Live Camera Box */}
                <div className="relative rounded-2xl overflow-hidden bg-[#1F211E] aspect-[4/3] flex items-center justify-center border border-[#D4E4D5]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={
                      capturedPhoto || cameraError
                        ? "hidden"
                        : "w-full h-full object-cover -scale-x-100"
                    }
                  />

                  {capturedPhoto && (
                    <img
                      src={capturedPhoto}
                      alt="Pratinjau foto selfie berwatermark"
                      width={640}
                      height={480}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {!capturedPhoto && cameraError && (
                    <div className="p-6 text-center text-[#F6FAF6] space-y-3">
                      <AlertTriangleIcon className="w-8 h-8 text-[#FEF3C7] mx-auto" />
                      <p className="text-xs sm:text-sm max-w-sm mx-auto">
                        {cameraError}
                      </p>
                      <button
                        type="button"
                        onClick={() => void startCamera()}
                        className="min-h-[44px] px-4 rounded-full bg-[#347F2F] text-white text-xs font-semibold"
                      >
                        Aktifkan Ulang Kamera
                      </button>
                    </div>
                  )}

                  {!capturedPhoto && !cameraError && !cameraReady && (
                    <p className="text-xs text-[#C4D0C4]">
                      Menghubungkan kamera browser...
                    </p>
                  )}
                </div>

                {/* Camera Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {!capturedPhoto ? (
                    <button
                      type="button"
                      disabled={!cameraReady || gpsLoading || userLat === null}
                      onClick={handleCaptureSelfie}
                      className="flex-1 min-h-[46px] rounded-full bg-[#1F211E] text-[#F6FAF6] text-sm font-semibold flex items-center justify-center gap-2 px-4 hover:bg-black disabled:opacity-50"
                    >
                      <CameraIcon className="w-4 h-4" />
                      <span>Ambil Foto Selfie</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setCapturedPhoto("")}
                      className="min-h-[46px] px-5 rounded-full border border-[#7A8F7C] bg-white text-[#1A1E1A] text-sm font-semibold hover:bg-[#F3F8F3]"
                    >
                      Foto Ulang
                    </button>
                  )}
                </div>

                {/* Dynamic Warning & Reason when Late */}
                {nextAction === "clock_in" && liveLateStatus.isLate && (
                  <div className="rounded-2xl bg-[#FEF3C7] border border-[#F59E0B]/40 p-4 space-y-2.5">
                    <div className="flex items-start gap-2 text-[#92400E]">
                      <AlertTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-bold">
                          Terlambat {liveLateStatus.lateMinutes} menit dari jadwal masuk ({settings?.workStartTime} WIB)
                        </p>
                        <p className="mt-0.5">
                          Potongan gaji otomatis:{" "}
                          <strong>
                            {formatRupiah(settings?.latePenaltyAmount ?? 0)}
                          </strong>
                          . Alasan wajib diisi sebelum absen.
                        </p>
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="absen-late-reason"
                        className="block text-xs font-bold text-[#92400E] mb-1"
                      >
                        Alasan Keterlambatan (wajib)
                      </label>
                      <textarea
                        id="absen-late-reason"
                        rows={2}
                        required
                        value={lateReason}
                        onChange={(e) => setLateReason(e.target.value)}
                        placeholder="Jelaskan alasan keterlambatan Anda (minimal 5 karakter)..."
                        className="w-full rounded-xl border border-[#92400E]/40 bg-white px-3 py-2 text-sm text-[#1A1E1A]"
                      />
                    </div>
                  </div>
                )}

                {/* Dynamic Warning & Reason when Outside Radius */}
                {isOutsideRadius && (
                  <div className="rounded-2xl bg-[#FEE2E2] border border-[#991B1B]/30 p-4 space-y-2.5">
                    <div className="flex items-start gap-2 text-[#991B1B]">
                      <MapPinIcon className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-bold">
                          Lokasi Anda berada di luar radius kantor ({distanceMeters} m dari batas {settings?.radiusMeters} m)
                        </p>
                        <p className="mt-0.5">
                          Absensi tetap dicatat sebagai status Luar Radius untuk verifikasi admin, dengan alasan wajib.
                        </p>
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="absen-outside-reason"
                        className="block text-xs font-bold text-[#991B1B] mb-1"
                      >
                        Alasan Absen di Luar Lokasi (wajib)
                      </label>
                      <textarea
                        id="absen-outside-reason"
                        rows={2}
                        required
                        value={outsideReason}
                        onChange={(e) => setOutsideReason(e.target.value)}
                        placeholder="Contoh: Sedang kunjungan klien di lokasi proyek..."
                        className="w-full rounded-xl border border-[#991B1B]/40 bg-white px-3 py-2 text-sm text-[#1A1E1A]"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !capturedPhoto ||
                    userLat === null ||
                    userLng === null
                  }
                  className="w-full min-h-[48px] rounded-full bg-[#246326] text-white text-sm font-bold hover:bg-[#1b4e1d] disabled:opacity-50"
                >
                  {submitting
                    ? "Menyimpan Absensi..."
                    : nextAction === "clock_in"
                      ? "Kirim Absen Masuk"
                      : "Kirim Absen Pulang"}
                </button>
              </>
            )}
          </form>

          {/* Right: Live GPS Status + Leaflet Mini Map */}
          <div className="lg:col-span-6 rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#1A1E1A]">
                  Lokasi GPS & Radius Kantor
                </h2>
                <p className="text-xs text-[#465147]">
                  Titik hijau adalah area kantor; pin biru menunjukkan koordinat GPS Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={requestGps}
                disabled={gpsLoading}
                className="min-h-[40px] px-3.5 rounded-full bg-[#F3F8F3] border border-[#7A8F7C] text-xs font-semibold text-[#1A1E1A] inline-flex items-center gap-1.5 hover:bg-[#E6F4E7]"
              >
                <RefreshIcon className={`w-3.5 h-3.5 ${gpsLoading ? "animate-spin" : ""}`} />
                <span>{gpsLoading ? "Mendeteksi..." : "Perbarui GPS"}</span>
              </button>
            </div>

            {/* Distance Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="rounded-2xl bg-[#F3F8F3] border border-[#DCEADC] p-3">
                <span className="block text-[11px] font-medium text-[#465147]">
                  Jarak ke Kantor
                </span>
                <span className="text-lg font-bold text-[#1A1E1A] tabular-nums">
                  {distanceMeters !== null ? `${distanceMeters} m` : "Mencari..."}
                </span>
              </div>
              <div className="rounded-2xl bg-[#F3F8F3] border border-[#DCEADC] p-3">
                <span className="block text-[11px] font-medium text-[#465147]">
                  Batas Radius
                </span>
                <span className="text-lg font-bold text-[#1A1E1A] tabular-nums">
                  {settings ? `${settings.radiusMeters} m` : "-"}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1 rounded-2xl p-3 border flex flex-col justify-center bg-[#F3F8F3] border-[#DCEADC]">
                <span className="block text-[11px] font-medium text-[#465147]">
                  Status Zona
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-sm font-bold ${
                    distanceMeters === null
                      ? "text-[#465147]"
                      : isOutsideRadius
                        ? "text-[#991B1B]"
                        : "text-[#1D5420]"
                  }`}
                >
                  {distanceMeters === null
                    ? "Menunggu GPS"
                    : isOutsideRadius
                      ? "Di Luar Radius"
                      : "Dalam Radius"}
                </span>
              </div>
            </div>

            {gpsError && (
              <div className="rounded-2xl bg-[#FEE2E2] text-[#991B1B] px-4 py-3 text-xs font-medium">
                {gpsError}
              </div>
            )}

            {settings && (
              <LeafletPicker
                lat={settings.officeLat}
                lng={settings.officeLng}
                radiusMeters={settings.radiusMeters}
                interactive={false}
                heightClass="h-64 sm:h-72"
                userLat={userLat}
                userLng={userLng}
              />
            )}

            <p className="text-[11px] text-[#465147] tabular-nums">
              Koordinat Anda:{" "}
              {userLat !== null && userLng !== null
                ? `${userLat.toFixed(6)}, ${userLng.toFixed(6)}`
                : "Belum terkunci"}
            </p>
          </div>
        </section>

        {/* Attendance History Table */}
        <section className="rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#1A1E1A]">
                Riwayat Absensi & Foto Selfie
              </h2>
              <p className="text-xs text-[#465147]">
                {initialUser.role === "admin"
                  ? "Menampilkan log kehadiran seluruh karyawan beserta foto berwatermark dan alasan."
                  : "Menampilkan riwayat absensi pribadi Anda."}
              </p>
            </div>

            {/* Filters */}
            <form
              onSubmit={handleApplySearch}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari nama atau kode..."
                aria-label="Cari riwayat absensi"
                className="min-h-[42px] w-full sm:w-48 rounded-full border border-[#7A8F7C] bg-white px-4 text-xs sm:text-sm text-[#1A1E1A]"
              />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setPage(1);
                  setDateFilter(e.target.value);
                }}
                aria-label="Filter tanggal"
                className="min-h-[42px] rounded-full border border-[#7A8F7C] bg-white px-3.5 text-xs sm:text-sm text-[#1A1E1A]"
              />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setPage(1);
                  setStatusFilter(e.target.value);
                }}
                aria-label="Filter status kehadiran"
                className="min-h-[42px] rounded-full border border-[#7A8F7C] bg-white px-3.5 text-xs sm:text-sm text-[#1A1E1A]"
              >
                <option value="all">Semua Status</option>
                <option value="ontime">Tepat Waktu</option>
                <option value="late">Terlambat</option>
                <option value="outside">Luar Radius</option>
              </select>
              <button
                type="submit"
                className="min-h-[42px] px-4 rounded-full bg-[#1F211E] text-[#F6FAF6] text-xs font-semibold hover:bg-black"
              >
                Cari
              </button>
            </form>
          </div>

          {loading ? (
            <div className="space-y-2.5">
              <div className="h-12 rounded-2xl bg-[#EEF5EE] animate-pulse" />
              <div className="h-12 rounded-2xl bg-[#EEF5EE] animate-pulse" />
              <div className="h-12 rounded-2xl bg-[#EEF5EE] animate-pulse" />
            </div>
          ) : errorMsg ? (
            <div className="rounded-2xl bg-[#FEE2E2] p-5 text-center space-y-2">
              <p className="text-sm font-semibold text-[#991B1B]">{errorMsg}</p>
              <button
                type="button"
                onClick={() => void loadAttendances()}
                className="min-h-[40px] px-4 rounded-full bg-[#991B1B] text-white text-xs font-semibold"
              >
                Coba Lagi
              </button>
            </div>
          ) : !payload || payload.records.length === 0 ? (
            <div className="rounded-2xl bg-[#F3F8F3] border border-dashed border-[#B7CEB8] p-6 text-center">
              <p className="text-sm font-semibold text-[#1A1E1A]">
                Tidak ada data absensi sesuai filter
              </p>
              <p className="text-xs text-[#465147] mt-1">
                Ubah kata kunci pencarian atau lakukan absensi selfie untuk menambahkan catatan baru.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Compact Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {payload.records.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-2xl bg-[#F6FAF6] border border-[#DCEADC] p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[#1A1E1A]">
                          {row.fullName}
                        </p>
                        <p className="text-xs text-[#465147]">
                          {row.attendanceCode} | {row.workDate}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          row.isLate
                            ? "bg-[#FEF3C7] text-[#92400E]"
                            : "bg-[#E6F4E7] text-[#1D5420]"
                        }`}
                      >
                        {row.isLate ? `Telat ${row.lateMinutes}m` : "Tepat"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-[#465147]">
                      <div>
                        Masuk: <strong className="text-[#1A1E1A]">{row.clockInTime}</strong>
                      </div>
                      <div>
                        Pulang: <strong className="text-[#1A1E1A]">{row.clockOutTime}</strong>
                      </div>
                    </div>

                    {row.penaltyAmount > 0 && (
                      <p className="text-xs font-semibold text-[#991B1B]">
                        Potongan Telat: {formatRupiah(row.penaltyAmount)}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => setDetailRow(row)}
                      className="w-full min-h-[40px] rounded-full border border-[#7A8F7C] bg-white text-xs font-semibold text-[#1A1E1A] flex items-center justify-center gap-1.5"
                    >
                      <EyeIcon className="w-3.5 h-3.5" />
                      <span>Lihat Foto & Detail</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Desktop & Laptop Fluid Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#DCEADC] text-[11px] font-bold uppercase tracking-wider text-[#465147]">
                      <th className="py-3 px-3">Kode / Tanggal</th>
                      <th className="py-3 px-3">Karyawan</th>
                      <th className="py-3 px-3">Masuk / Pulang</th>
                      <th className="py-3 px-3">Status & Lokasi</th>
                      <th className="py-3 px-3 text-right">Potongan</th>
                      <th className="py-3 px-3 text-right">Bukti Selfie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF5EE] text-sm">
                    {payload.records.map((row) => (
                      <tr key={row.id} className="hover:bg-[#F5FAF5]">
                        <td className="py-3 px-3 tabular-nums">
                          <div className="font-semibold text-[#1A1E1A] text-xs">
                            {row.attendanceCode}
                          </div>
                          <div className="text-xs text-[#465147]">
                            {row.workDate}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[#1A1E1A]">
                            {row.fullName}
                          </div>
                          <div className="text-xs text-[#465147]">
                            {row.employeeCode} | {row.position}
                          </div>
                        </td>
                        <td className="py-3 px-3 tabular-nums text-xs">
                          <div>
                            Masuk: <strong>{row.clockInTime}</strong>
                          </div>
                          <div className="text-[#465147]">
                            Pulang: <strong>{row.clockOutTime}</strong>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                row.isLate
                                  ? "bg-[#FEF3C7] text-[#92400E]"
                                  : "bg-[#E6F4E7] text-[#1D5420]"
                              }`}
                            >
                              {row.isLate
                                ? `Telat ${row.lateMinutes} mnt`
                                : "Tepat Waktu"}
                            </span>
                            {(row.isOutsideIn || row.isOutsideOut) && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEE2E2] text-[#991B1B]">
                                Luar Radius
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold tabular-nums text-xs text-[#991B1B]">
                          {row.penaltyAmount > 0
                            ? formatRupiah(row.penaltyAmount)
                            : "-"}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setDetailRow(row)}
                            className="min-h-[36px] px-3 rounded-full bg-[#F3F8F3] border border-[#7A8F7C] text-xs font-semibold text-[#1A1E1A] inline-flex items-center gap-1 hover:bg-[#E6F4E7]"
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EEF5EE] text-xs text-[#465147]">
                <span>
                  Halaman {payload.page} dari {payload.totalPages} ({payload.total} catatan)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={payload.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="min-h-[38px] px-3.5 rounded-full border border-[#7A8F7C] bg-white text-[#1A1E1A] font-semibold disabled:opacity-45"
                  >
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    disabled={payload.page >= payload.totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(payload.totalPages, p + 1))
                    }
                    className="min-h-[38px] px-3.5 rounded-full border border-[#7A8F7C] bg-white text-[#1A1E1A] font-semibold disabled:opacity-45"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Selfie & Detail Lightbox Modal */}
      <Modal
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
        title={`Detail Absensi ${detailRow?.attendanceCode ?? ""}`}
        maxWidthClass="max-w-2xl"
      >
        {detailRow && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#F3F8F3] border border-[#DCEADC] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[#465147]">Karyawan</p>
                <p className="font-bold text-sm text-[#1A1E1A]">
                  {detailRow.fullName} ({detailRow.employeeCode})
                </p>
              </div>
              <div>
                <p className="text-[#465147]">Tanggal & Shift</p>
                <p className="font-bold text-sm text-[#1A1E1A] tabular-nums">
                  {detailRow.workDate} | {detailRow.clockInTime} -{" "}
                  {detailRow.clockOutTime} WIB
                </p>
              </div>
              <div>
                <p className="text-[#465147]">Jarak Masuk / Pulang</p>
                <p className="font-semibold text-[#1A1E1A] tabular-nums">
                  {detailRow.clockInDistanceMeters ?? "-"} m /{" "}
                  {detailRow.clockOutDistanceMeters ?? "-"} m
                </p>
              </div>
              <div>
                <p className="text-[#465147]">Potongan Telat</p>
                <p className="font-semibold text-[#991B1B] tabular-nums">
                  {detailRow.penaltyAmount > 0
                    ? `${formatRupiah(detailRow.penaltyAmount)} (${detailRow.lateMinutes} menit)`
                    : "Tidak ada potongan"}
                </p>
              </div>
            </div>

            {detailRow.lateReason && (
              <div className="rounded-2xl bg-[#FEF3C7] p-3 text-xs text-[#92400E]">
                <strong>Alasan Terlambat:</strong> {detailRow.lateReason}
              </div>
            )}
            {detailRow.outsideInReason && (
              <div className="rounded-2xl bg-[#FEE2E2] p-3 text-xs text-[#991B1B]">
                <strong>Alasan Luar Radius (Masuk):</strong>{" "}
                {detailRow.outsideInReason}
              </div>
            )}
            {detailRow.outsideOutReason && (
              <div className="rounded-2xl bg-[#FEE2E2] p-3 text-xs text-[#991B1B]">
                <strong>Alasan Luar Radius (Pulang):</strong>{" "}
                {detailRow.outsideOutReason}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-[#1A1E1A]">
                  Foto Selfie Masuk
                </p>
                {detailRow.clockInPhoto ? (
                  <img
                    src={detailRow.clockInPhoto}
                    alt={`Selfie masuk ${detailRow.fullName}`}
                    width={640}
                    height={480}
                    className="w-full rounded-2xl border border-[#DCEADC] object-cover"
                  />
                ) : (
                  <div className="h-40 rounded-2xl bg-[#F3F8F3] flex items-center justify-center text-xs text-[#465147]">
                    Tidak ada foto masuk
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-[#1A1E1A]">
                  Foto Selfie Pulang
                </p>
                {detailRow.clockOutPhoto ? (
                  <img
                    src={detailRow.clockOutPhoto}
                    alt={`Selfie pulang ${detailRow.fullName}`}
                    width={640}
                    height={480}
                    className="w-full rounded-2xl border border-[#DCEADC] object-cover"
                  />
                ) : (
                  <div className="h-40 rounded-2xl bg-[#F3F8F3] flex items-center justify-center text-xs text-[#465147]">
                    Belum absen pulang
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
