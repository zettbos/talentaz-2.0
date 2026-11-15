"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth";
import { formatMinutesAsHours, formatRupiah } from "@/lib/time";
import { useCachedQuery } from "@/lib/use-cached-query";
import { AppShell } from "./AppShell";
import { useDataCache } from "./DataCacheContext";
import { useToast } from "./ToastContext";
import { Modal } from "./Modal";
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClipboardCheckIcon,
  ClockIcon,
  MapPinIcon,
  UsersIcon,
} from "./Icons";

interface DashboardSettings {
  companyName: string;
  officeLat: number;
  officeLng: number;
  radiusMeters: number;
  workStartTime: string;
  workEndTime: string;
  lateGraceMinutes: number;
  latePenaltyAmount: number;
  overtimeHourlyRate: number;
}

interface DashboardLeaveItem {
  id: number;
  code: string;
  fullName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  attachmentDataUrl: string | null;
  attachmentName: string | null;
}

interface DashboardOvertimeItem {
  id: number;
  code: string;
  fullName: string;
  overtimeDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  taskDescription: string;
  estimatedPay: number;
  status: string;
}

interface DashboardPayload {
  user: SafeUser;
  settings: DashboardSettings | null;
  wibNow: {
    workDate: string;
    hhmm: string;
    displayDate: string;
  };
  todaySelf: {
    id: number;
    attendanceCode: string;
    clockInTime: string;
    clockOutTime: string;
    isLate: boolean;
    lateMinutes: number;
    isOutsideIn: boolean;
    penaltyAmount: number;
  } | null;
  shiftTracker: {
    workedTodayMinutes: number;
    scheduledShiftMinutes: number;
    progressPct: number;
  };
  kpis: {
    activeEmployees: number;
    presentToday: number;
    onTimeToday: number;
    lateToday: number;
    outsideToday: number;
    pendingTotal: number;
    pendingLeaves: number;
    pendingOvertimes: number;
    attendancePct: number;
    onTimePct: number;
    latePct: number;
    outsidePct: number;
  };
  weeklyBars: Array<{
    workDate: string;
    labelShort: string;
    dayNumber: string;
    totalHours: number;
    totalMinutes: number;
    count: number;
    isToday: boolean;
  }>;
  timelineLogs: Array<{
    id: number;
    code: string;
    workDate: string;
    fullName: string;
    clockInTime: string;
    clockOutTime: string;
    isLate: boolean;
    isOutsideIn: boolean;
  }>;
  personalMonthStats: {
    presentDays: number;
    lateCount: number;
    totalPenalty: number;
    overtimeMinutes: number;
    overtimePay: number;
    estimatedNetSalary: number;
  };
  leaveItems: DashboardLeaveItem[];
  overtimeItems: DashboardOvertimeItem[];
}

interface ReviewTarget {
  kind: "leave" | "overtime";
  id: number;
  code: string;
  fullName: string;
  summary: string;
  decision: "approved" | "rejected";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function DashboardClient({ initialUser }: { initialUser: SafeUser }) {
  const { invalidatePrefix } = useDataCache();
  const { showToast } = useToast();

  const {
    data,
    loading,
    errorMsg,
    refetch: loadDashboard,
  } = useCachedQuery<DashboardPayload>(
    "dashboard",
    "/api/dashboard",
    "Gagal memuat ringkasan dashboard."
  );

  const [openSection, setOpenSection] = useState<
    "schedule" | "today" | "salary" | "penalty"
  >("today");
  const [extraElapsedMin, setExtraElapsedMin] = useState(0);

  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (
      !data?.todaySelf ||
      data.todaySelf.clockInTime === "-" ||
      data.todaySelf.clockOutTime !== "-"
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setExtraElapsedMin((prev) => prev + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [data?.todaySelf]);

  async function handleConfirmReview(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewTarget) return;
    setSubmittingReview(true);
    try {
      const endpoint =
        reviewTarget.kind === "leave"
          ? `/api/leaves/${reviewTarget.id}`
          : `/api/overtimes/${reviewTarget.id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: reviewTarget.decision,
          reviewNote: reviewNote.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal memproses persetujuan.");
      }

      showToast(
        `${reviewTarget.code} berhasil ${
          reviewTarget.decision === "approved" ? "disetujui" : "ditolak"
        }.`,
        "success"
      );
      setReviewTarget(null);
      setReviewNote("");
      invalidatePrefix("dashboard");
      invalidatePrefix("leaves");
      invalidatePrefix("overtimes");
      invalidatePrefix("reports");
      await loadDashboard();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal memproses persetujuan.",
        "error"
      );
    } finally {
      setSubmittingReview(false);
    }
  }

  const activeUser = data?.user ?? initialUser;
  const isAdmin = activeUser.role === "admin";
  const firstName = activeUser.fullName.split(" ")[0] || activeUser.fullName;

  const totalWeeklyHours = useMemo(() => {
    if (!data) return 0;
    const total = data.weeklyBars.reduce((sum, b) => sum + b.totalHours, 0);
    return Math.round(total * 10) / 10;
  }, [data]);

  const maxWeeklyMinutes = useMemo(() => {
    if (!data || data.weeklyBars.length === 0) return 60;
    const peak = Math.max(...data.weeklyBars.map((b) => b.totalMinutes), 60);
    return peak;
  }, [data]);

  const combinedTasks = useMemo(() => {
    if (!data) return [];
    const leaves = data.leaveItems.map((l) => ({
      kind: "leave" as const,
      id: l.id,
      code: l.code,
      fullName: l.fullName,
      title: `${l.leaveType.toUpperCase()} (${l.startDate})`,
      subtitle: l.reason,
      status: l.status,
    }));
    const overtimes = data.overtimeItems.map((o) => ({
      kind: "overtime" as const,
      id: o.id,
      code: o.code,
      fullName: o.fullName,
      title: `Lembur ${o.overtimeDate} (${o.startTime}-${o.endTime})`,
      subtitle: `${formatRupiah(o.estimatedPay)} | ${o.taskDescription}`,
      status: o.status,
    }));
    return [...leaves, ...overtimes].slice(0, 6);
  }, [data]);

  const liveWorkedMinutes =
    (data?.shiftTracker.workedTodayMinutes ?? 0) + extraElapsedMin;
  const scheduledShiftMinutes = data?.shiftTracker.scheduledShiftMinutes ?? 540;
  const liveProgressPct = Math.min(
    100,
    Math.round((liveWorkedMinutes / Math.max(60, scheduledShiftMinutes)) * 100)
  );

  // SVG Time Tracker Ring geometry.
  const ringRadius = 64;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringStrokeOffset =
    ringCircumference - (liveProgressPct / 100) * ringCircumference;

  const onTimeShare = data?.kpis.onTimePct ?? 0;
  const lateShare = data?.kpis.latePct ?? 0;
  const otherShare = Math.max(0, 100 - onTimeShare - lateShare);

  const absenActionLabel = !data?.todaySelf
    ? "Absen Masuk Sekarang"
    : data.todaySelf.clockOutTime === "-"
      ? "Absen Pulang Sekarang"
      : "Absensi Hari Ini Selesai";

  return (
    <AppShell
      user={activeUser}
      companyName={data?.settings?.companyName ?? "TalentaZ 2.0"}
      pendingCount={data?.kpis.pendingTotal ?? 0}
      onRefresh={() => {
        invalidatePrefix("dashboard");
        void loadDashboard();
      }}
    >
      {loading && !data ? (
        <div className="space-y-5" aria-busy="true" aria-label="Memuat dashboard">
          <div className="h-24 rounded-3xl bg-white/75 animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-3 h-96 rounded-[28px] bg-white/75 animate-pulse" />
            <div className="lg:col-span-6 h-96 rounded-[28px] bg-white/75 animate-pulse" />
            <div className="lg:col-span-3 h-96 rounded-[28px] bg-[#1F211E]/20 animate-pulse" />
          </div>
        </div>
      ) : errorMsg && !data ? (
        <div className="rounded-[28px] bg-white p-8 text-center border border-[#D4E4D5] shadow-sm">
          <AlertTriangleIcon className="w-10 h-10 text-[#991B1B] mx-auto mb-3" />
          <h1 className="text-xl font-bold text-[#1A1E1A]">
            Gagal Memuat Dashboard
          </h1>
          <p className="text-sm text-[#465147] mt-1 max-w-md mx-auto">
            {errorMsg}
          </p>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="mt-5 inline-flex items-center justify-center min-h-[44px] px-5 rounded-full bg-[#246326] text-white text-sm font-semibold hover:bg-[#1b4e1d]"
          >
            Muat Ulang Data
          </button>
        </div>
      ) : data ? (
        <div className="space-y-5">
          {/* Mobile Quick Selfie Card for instant thumb action */}
          <section className="lg:hidden rounded-[24px] bg-[#1F211E] text-[#F6FAF6] p-4 shadow-md flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-[#C4D0C4]">
                  {data.wibNow.displayDate} | {data.wibNow.hhmm} WIB
                </p>
                <h2 className="text-base font-bold mt-0.5">
                  {data.todaySelf
                    ? `Masuk ${data.todaySelf.clockInTime} | Pulang ${data.todaySelf.clockOutTime}`
                    : "Belum Absen Masuk Hari Ini"}
                </h2>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                  data.todaySelf?.isLate
                    ? "bg-[#FEF3C7] text-[#92400E]"
                    : data.todaySelf
                      ? "bg-[#E6F4E7] text-[#1D5420]"
                      : "bg-white/15 text-[#F6FAF6]"
                }`}
              >
                {data.todaySelf
                  ? data.todaySelf.isLate
                    ? `Telat ${data.todaySelf.lateMinutes}m`
                    : "Tepat Waktu"
                  : "Menunggu"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/absen"
                className="min-h-[44px] rounded-full bg-[#347F2F] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 px-3"
              >
                <CameraIcon className="w-4 h-4 shrink-0" />
                <span>{!data.todaySelf ? "Absen Masuk" : data.todaySelf.clockOutTime === "-" ? "Absen Pulang" : "Lihat Absen"}</span>
              </Link>
              <Link
                href="/pengajuan"
                className="min-h-[44px] rounded-full bg-white/12 text-[#F6FAF6] text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 px-3 hover:bg-white/20"
              >
                <ClipboardCheckIcon className="w-4 h-4 shrink-0" />
                <span>Izin / Lembur</span>
              </Link>
            </div>
          </section>

          {/* Hero Welcome Header + Horizontal Pills + 3 Large Metrics */}
          <section className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
            <div className="space-y-4 flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A1E1A]">
                    Selamat Datang, {firstName}
                  </h1>
                  <p className="text-xs sm:text-sm text-[#465147] mt-0.5">
                    {isAdmin
                      ? "Pemantauan kehadiran, lokasi GPS, lembur, dan potongan gaji karyawan."
                      : "Pantau jam masuk, radius kantor, pengajuan izin/lembur, dan estimasi gaji."}
                  </p>
                </div>
                <span className="text-xs font-medium text-[#465147] bg-white/80 border border-[#D4E4D5] px-3 py-1 rounded-full">
                  {data.wibNow.displayDate} | {data.wibNow.hhmm} WIB
                </span>
              </div>

              {/* Crextio-style horizontal metric pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                <div>
                  <span className="block text-[11px] font-medium text-[#465147] mb-1">
                    {isAdmin ? "Hadir Hari Ini" : "Status Hari Ini"}
                  </span>
                  <div className="h-9 rounded-full bg-[#1F211E] text-[#F6FAF6] px-4 flex items-center justify-between text-xs font-semibold tabular-nums">
                    <span>{data.kpis.attendancePct}%</span>
                    <span className="text-[#C4D0C4] font-normal">
                      {isAdmin ? `${data.kpis.presentToday}/${data.kpis.activeEmployees}` : data.todaySelf ? "Hadir" : "Belum"}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] font-medium text-[#465147] mb-1">
                    Tepat Waktu
                  </span>
                  <div className="h-9 rounded-full bg-[#347F2F] text-white px-4 flex items-center justify-between text-xs font-semibold tabular-nums">
                    <span>{data.kpis.onTimePct}%</span>
                    <span className="text-[#E6F4E7] font-normal">Bulan ini</span>
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <span className="block text-[11px] font-medium text-[#465147] mb-1">
                    Keterlambatan
                  </span>
                  <div className="h-9 rounded-full striped-sage-track border border-[#B8D4B9] overflow-hidden relative flex items-center">
                    <div
                      className="h-full striped-green-fill rounded-full transition-all"
                      style={{
                        width: `${Math.max(18, Math.min(100, 100 - data.kpis.latePct))}%`,
                      }}
                    />
                    <span className="absolute inset-0 px-3 flex items-center justify-between text-xs font-semibold text-[#1A1E1A] tabular-nums">
                      <span className="bg-white/85 px-1.5 py-0.5 rounded-full">
                        {data.kpis.latePct}% Telat
                      </span>
                    </span>
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <span className="block text-[11px] font-medium text-[#465147] mb-1">
                    Luar Radius
                  </span>
                  <div className="h-9 rounded-full bg-white/80 border border-[#7A8F7C] text-[#1A1E1A] px-4 flex items-center justify-between text-xs font-semibold tabular-nums">
                    <span>{data.kpis.outsidePct}%</span>
                    <span className="text-[#465147] font-normal">Audit GPS</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Huge Counters matching the reference top-right KPI trio */}
            <div className="grid grid-cols-3 gap-4 sm:gap-6 shrink-0 pt-2 xl:pt-0">
              <div className="bg-white/60 sm:bg-transparent rounded-2xl p-3 sm:p-0">
                <div className="flex items-baseline gap-1.5">
                  <UsersIcon className="w-4 h-4 text-[#465147] shrink-0" />
                  <span className="text-2xl sm:text-4xl font-bold tracking-tight text-[#1A1E1A] tabular-nums">
                    {isAdmin ? data.kpis.presentToday : data.personalMonthStats.presentDays}
                  </span>
                </div>
                <p className="text-xs text-[#465147] mt-0.5">
                  {isAdmin ? `dari ${data.kpis.activeEmployees} Karyawan` : "Hadir Bulan Ini"}
                </p>
              </div>

              <div className="bg-white/60 sm:bg-transparent rounded-2xl p-3 sm:p-0">
                <div className="flex items-baseline gap-1.5">
                  <ClockIcon className="w-4 h-4 text-[#92400E] shrink-0" />
                  <span className="text-2xl sm:text-4xl font-bold tracking-tight text-[#1A1E1A] tabular-nums">
                    {isAdmin ? data.kpis.lateToday : data.personalMonthStats.lateCount}
                  </span>
                </div>
                <p className="text-xs text-[#465147] mt-0.5">
                  {isAdmin ? "Telat Hari Ini" : "Telat Bulan Ini"}
                </p>
              </div>

              <div className="bg-white/60 sm:bg-transparent rounded-2xl p-3 sm:p-0">
                <div className="flex items-baseline gap-1.5">
                  <ClipboardCheckIcon className="w-4 h-4 text-[#246326] shrink-0" />
                  <span className="text-2xl sm:text-4xl font-bold tracking-tight text-[#1A1E1A] tabular-nums">
                    {isAdmin
                      ? data.kpis.pendingTotal
                      : `${Math.round((data.personalMonthStats.overtimeMinutes / 60) * 10) / 10}j`}
                  </span>
                </div>
                <p className="text-xs text-[#465147] mt-0.5">
                  {isAdmin ? "Perlu Approval" : "Lembur Disetujui"}
                </p>
              </div>
            </div>
          </section>

          {/* Main 12-Column Bento Grid */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-stretch">
            {/* LEFT COLUMN: Profile Portrait Card + Accordion Summary */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              {/* Employee Portrait Card */}
              <div className="relative rounded-[28px] overflow-hidden min-h-[240px] bg-gradient-to-br from-[#d3e6d4] via-[#c3dcc5] to-[#9ebd9f] border border-white/80 shadow-sm flex flex-col justify-between p-5">
                <div className="flex items-start justify-between gap-2 z-10">
                  <span className="px-2.5 py-1 rounded-full bg-white/85 text-[#1A1E1A] text-xs font-semibold">
                    {activeUser.employeeCode}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-[#1F211E]/85 text-[#F6FAF6] text-xs font-medium uppercase">
                    {activeUser.role === "admin" ? "Admin / Atasan" : "Karyawan"}
                  </span>
                </div>

                <div className="flex items-center justify-center my-3 z-10">
                  {activeUser.avatarDataUrl ? (
                    <img
                      src={activeUser.avatarDataUrl}
                      alt={activeUser.fullName}
                      width={112}
                      height={112}
                      className="w-28 h-28 rounded-full object-cover border-4 border-white/85 shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-[#1F211E] text-[#F6FAF6] border-4 border-white/80 shadow-md flex items-center justify-center text-2xl font-bold tracking-wide">
                      {getInitials(activeUser.fullName)}
                    </div>
                  )}
                </div>

                {/* Bottom frosted nameplate + estimated net salary pill */}
                <div className="rounded-2xl bg-[#1F211E]/75 backdrop-blur-md p-3.5 text-[#F6FAF6] flex items-center justify-between gap-2 z-10">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">
                      {activeUser.fullName}
                    </p>
                    <p className="text-xs text-[#C4D0C4] truncate">
                      {activeUser.position}
                    </p>
                  </div>
                  <span
                    className="px-3 py-1.5 rounded-full bg-white/18 border border-white/30 text-white text-xs font-semibold tabular-nums shrink-0"
                    title="Estimasi gaji bersih bulan berjalan"
                  >
                    {formatRupiah(data.personalMonthStats.estimatedNetSalary)}
                  </span>
                </div>
              </div>

              {/* Left-Bottom Accordion Card matching reference */}
              <div className="rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-4 sm:p-5 flex-1 flex flex-col justify-between gap-1">
                {/* Item 1: Status Hari Ini */}
                <div className="border-b border-[#E5EFE6] pb-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSection((prev) =>
                        prev === "today" ? "schedule" : "today"
                      )
                    }
                    className="w-full min-h-[44px] flex items-center justify-between text-left text-sm font-semibold text-[#1A1E1A]"
                  >
                    <span>Status Absen Hari Ini</span>
                    <ChevronDownIcon
                      className={`w-4 h-4 text-[#465147] transition-transform ${
                        openSection === "today" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openSection === "today" && (
                    <div className="pt-1 pb-2 text-xs text-[#465147] space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Jam Masuk / Pulang</span>
                        <span className="font-semibold text-[#1A1E1A] tabular-nums">
                          {data.todaySelf
                            ? `${data.todaySelf.clockInTime} / ${data.todaySelf.clockOutTime}`
                            : "Belum absen"}
                        </span>
                      </div>
                      {data.todaySelf?.isLate && (
                        <p className="text-[#92400E] bg-[#FEF3C7] px-2.5 py-1 rounded-lg font-medium">
                          Terlambat {data.todaySelf.lateMinutes} menit (Potongan{" "}
                          {formatRupiah(data.todaySelf.penaltyAmount)})
                        </p>
                      )}
                      {data.todaySelf?.isOutsideIn && (
                        <p className="text-[#991B1B] bg-[#FEE2E2] px-2.5 py-1 rounded-lg font-medium">
                          Masuk di luar radius kantor (dengan alasan)
                        </p>
                      )}
                      <Link
                        href="/absen"
                        className="mt-1 inline-flex w-full min-h-[40px] items-center justify-center rounded-full bg-[#246326] text-white font-semibold hover:bg-[#1b4e1d]"
                      >
                        {absenActionLabel}
                      </Link>
                    </div>
                  )}
                </div>

                {/* Item 2: Jadwal & Radius Kantor */}
                <div className="border-b border-[#E5EFE6] pb-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSection((prev) =>
                        prev === "schedule" ? "salary" : "schedule"
                      )
                    }
                    className="w-full min-h-[44px] flex items-center justify-between text-left text-sm font-semibold text-[#1A1E1A]"
                  >
                    <span>Jam Kerja & Radius GPS</span>
                    <ChevronDownIcon
                      className={`w-4 h-4 text-[#465147] transition-transform ${
                        openSection === "schedule" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openSection === "schedule" && data.settings && (
                    <div className="pt-1 pb-2 text-xs text-[#465147] space-y-1.5">
                      <div className="flex justify-between">
                        <span>Jam Kerja</span>
                        <span className="font-semibold text-[#1A1E1A] tabular-nums">
                          {data.settings.workStartTime} - {data.settings.workEndTime} WIB
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Toleransi Telat</span>
                        <span className="font-semibold text-[#1A1E1A] tabular-nums">
                          {data.settings.lateGraceMinutes} menit
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Batas Radius</span>
                        <span className="font-semibold text-[#1A1E1A] tabular-nums inline-flex items-center gap-1">
                          <MapPinIcon className="w-3.5 h-3.5 text-[#347F2F]" />
                          {data.settings.radiusMeters} m
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Item 3: Ringkasan Gaji Bulan Ini */}
                <div className="border-b border-[#E5EFE6] pb-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSection((prev) =>
                        prev === "salary" ? "penalty" : "salary"
                      )
                    }
                    className="w-full min-h-[44px] flex items-center justify-between text-left text-sm font-semibold text-[#1A1E1A]"
                  >
                    <span>Ringkasan Gaji Bulan Ini</span>
                    <ChevronDownIcon
                      className={`w-4 h-4 text-[#465147] transition-transform ${
                        openSection === "salary" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openSection === "salary" && (
                    <div className="pt-1 pb-2 text-xs text-[#465147] space-y-1.5">
                      <div className="flex justify-between">
                        <span>Gaji Pokok</span>
                        <span className="font-semibold text-[#1A1E1A] tabular-nums">
                          {formatRupiah(activeUser.baseSalary)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Lembur Disetujui</span>
                        <span className="font-semibold text-[#1D5420] tabular-nums">
                          +{formatRupiah(data.personalMonthStats.overtimePay)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Potongan Telat</span>
                        <span className="font-semibold text-[#991B1B] tabular-nums">
                          -{formatRupiah(data.personalMonthStats.totalPenalty)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Item 4: Aturan Potongan & Lembur */}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSection((prev) =>
                        prev === "penalty" ? "today" : "penalty"
                      )
                    }
                    className="w-full min-h-[44px] flex items-center justify-between text-left text-sm font-semibold text-[#1A1E1A]"
                  >
                    <span>Tarif Potongan & Lembur</span>
                    <ChevronDownIcon
                      className={`w-4 h-4 text-[#465147] transition-transform ${
                        openSection === "penalty" ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openSection === "penalty" && data.settings && (
                    <div className="pt-1 pb-1 text-xs text-[#465147] space-y-1.5">
                      <div className="flex justify-between">
                        <span>Potongan / Telat</span>
                        <span className="font-semibold text-[#991B1B] tabular-nums">
                          {formatRupiah(data.settings.latePenaltyAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tarif Lembur / Jam</span>
                        <span className="font-semibold text-[#1D5420] tabular-nums">
                          {formatRupiah(data.settings.overtimeHourlyRate)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CENTER COLUMN: Weekly Progress + Time Tracker + Weekly Timeline */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Progress Card (7-day stem + capsule bar chart) */}
                <div className="rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-[#1A1E1A]">
                        Jam Kerja Minggu Ini
                      </h2>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-bold tracking-tight text-[#1A1E1A] tabular-nums">
                          {totalWeeklyHours} j
                        </span>
                        <span className="text-xs text-[#465147]">
                          {isAdmin ? "Akumulasi tim" : "Jam tercatat"}
                        </span>
                      </div>
                    </div>
                    <Link
                      href="/rekap"
                      aria-label="Lihat rekap lengkap"
                      className="w-10 h-10 rounded-full border border-[#D4E4D5] bg-[#F3F8F3] hover:bg-[#E6F4E7] flex items-center justify-center text-[#1A1E1A] text-sm font-bold shrink-0"
                    >
                      -&gt;
                    </Link>
                  </div>

                  {/* Capsule Vertical Bar Chart */}
                  <div className="mt-5 grid grid-cols-7 gap-2 items-end h-36 pt-6">
                    {data.weeklyBars.map((bar) => {
                      const heightPct =
                        bar.totalMinutes > 0
                          ? Math.max(
                              18,
                              Math.round(
                                (bar.totalMinutes / maxWeeklyMinutes) * 100
                              )
                            )
                          : 12;
                      return (
                        <div
                          key={bar.workDate}
                          className="flex flex-col items-center justify-end h-full gap-1.5 relative"
                        >
                          {bar.isToday && (
                            <span className="absolute -top-5 whitespace-nowrap px-2 py-0.5 rounded-full bg-[#347F2F] text-white text-[10px] font-semibold tabular-nums shadow-sm">
                              {bar.totalHours}j
                            </span>
                          )}
                          <div className="w-full flex-1 flex items-end justify-center">
                            <div className="w-3 rounded-full bg-[#EAF4EA] h-full flex items-end justify-center overflow-hidden p-0.5">
                              <div
                                className={`w-full rounded-full transition-all ${
                                  bar.isToday
                                    ? "bg-[#347F2F]"
                                    : bar.totalMinutes > 0
                                      ? "bg-[#1F211E]"
                                      : "bg-[#C7DAC8]"
                                }`}
                                style={{ height: `${heightPct}%` }}
                                title={`${bar.labelShort} (${bar.workDate}): ${bar.totalHours} jam (${bar.count} log)`}
                              />
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-semibold ${
                              bar.isToday ? "text-[#246326]" : "text-[#465147]"
                            }`}
                          >
                            {bar.labelShort[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Circular Time Tracker Card */}
                <div className="rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-[#1A1E1A]">
                        Time Tracker
                      </h2>
                      <p className="text-xs text-[#465147] mt-0.5">
                        Shift {data.settings?.workStartTime ?? "08:00"} -{" "}
                        {data.settings?.workEndTime ?? "17:00"} WIB
                      </p>
                    </div>
                    <Link
                      href="/absen"
                      aria-label="Buka halaman absensi"
                      className="w-10 h-10 rounded-full border border-[#D4E4D5] bg-[#F3F8F3] hover:bg-[#E6F4E7] flex items-center justify-center text-[#1A1E1A] text-sm font-bold shrink-0"
                    >
                      -&gt;
                    </Link>
                  </div>

                  {/* SVG Ring */}
                  <div className="relative w-40 h-40 mx-auto my-2 flex items-center justify-center">
                    <svg
                      viewBox="0 0 160 160"
                      className="w-40 h-40 -rotate-90"
                      aria-hidden="true"
                    >
                      <circle
                        cx="80"
                        cy="80"
                        r={ringRadius}
                        fill="none"
                        stroke="#DCEADC"
                        strokeWidth="8"
                        strokeDasharray="3 5"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r={ringRadius}
                        fill="none"
                        stroke="#347F2F"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringStrokeOffset}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-bold text-[#1A1E1A] tabular-nums">
                        {formatMinutesAsHours(liveWorkedMinutes)}
                      </span>
                      <span className="text-[11px] font-medium text-[#465147] mt-0.5">
                        Durasi Kerja
                      </span>
                    </div>
                  </div>

                  {/* Bottom controls */}
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href="/absen"
                      className="flex-1 min-h-[44px] rounded-full bg-[#246326] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 px-3 hover:bg-[#1b4e1d]"
                    >
                      <CameraIcon className="w-4 h-4 shrink-0" />
                      <span>
                        {!data.todaySelf
                          ? "Absen Masuk"
                          : data.todaySelf.clockOutTime === "-"
                            ? "Absen Pulang"
                            : "Sudah Pulang"}
                      </span>
                    </Link>
                    <span
                      className="w-11 h-11 rounded-full bg-[#1F211E] text-[#F6FAF6] flex items-center justify-center text-xs font-bold tabular-nums shrink-0"
                      title="Persentase progres shift hari ini"
                    >
                      {liveProgressPct}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Center-Bottom Weekly Timeline & Logs Strip */}
              <div className="rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 flex-1 flex flex-col justify-between">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-base font-bold text-[#1A1E1A]">
                      Linimasa Absensi Minggu Ini
                    </h2>
                    <p className="text-xs text-[#465147]">
                      Log kehadiran real-time berdasarkan zona waktu WIB
                    </p>
                  </div>
                  <Link
                    href="/rekap"
                    className="min-h-[36px] px-3.5 rounded-full bg-[#F3F8F3] border border-[#D4E4D5] text-xs font-semibold text-[#1A1E1A] inline-flex items-center hover:bg-[#E6F4E7]"
                  >
                    Rekap & PDF
                  </Link>
                </div>

                {/* Day strip header matching Crextio calendar strip */}
                <div className="grid grid-cols-7 gap-1.5 text-center border-b border-[#E5EFE6] pb-2.5 mb-3">
                  {data.weeklyBars.map((d) => (
                    <div
                      key={d.workDate}
                      className={`rounded-xl py-1.5 px-1 ${
                        d.isToday ? "bg-[#1F211E] text-[#F6FAF6]" : "text-[#465147]"
                      }`}
                    >
                      <div className="text-[11px] font-medium">{d.labelShort}</div>
                      <div className="text-xs sm:text-sm font-bold tabular-nums">
                        {d.dayNumber}
                      </div>
                    </div>
                  ))}
                </div>

                {data.timelineLogs.length === 0 ? (
                  <div className="rounded-2xl bg-[#F3F8F3] border border-dashed border-[#B7CEB8] p-4 text-center">
                    <p className="text-sm font-semibold text-[#1A1E1A]">
                      Belum ada catatan absensi pada minggu ini
                    </p>
                    <p className="text-xs text-[#465147] mt-1">
                      Lakukan absensi selfie pertama untuk menampilkan jejak jam masuk di linimasa.
                    </p>
                    <Link
                      href="/absen"
                      className="mt-3 inline-flex min-h-[40px] items-center justify-center px-4 rounded-full bg-[#246326] text-white text-xs font-semibold"
                    >
                      Mulai Absen Selfie
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.timelineLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F4F9F4] border border-[#E2EEE3] px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              log.isLate || log.isOutsideIn
                                ? "bg-[#92400E]"
                                : "bg-[#347F2F]"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-[#1A1E1A] truncate">
                              {log.fullName}
                              <span className="ml-1.5 text-[11px] font-normal text-[#465147]">
                                ({log.code})
                              </span>
                            </p>
                            <p className="text-[11px] text-[#465147]">
                              {log.workDate} | Masuk {log.clockInTime} / Pulang{" "}
                              {log.clockOutTime}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              log.isLate
                                ? "bg-[#FEF3C7] text-[#92400E]"
                                : "bg-[#E6F4E7] text-[#1D5420]"
                            }`}
                          >
                            {log.isLate ? "Telat" : "Tepat"}
                          </span>
                          {log.isOutsideIn && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEE2E2] text-[#991B1B]">
                              Luar Radius
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Split Target Card + Dark Charcoal Checklist */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              {/* Top Light Card matching Onboarding Split Target */}
              <div className="rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-base font-bold text-[#1A1E1A]">
                    {isAdmin ? "Komposisi Disiplin" : "Disiplin Bulan Ini"}
                  </h2>
                  <span className="text-2xl font-bold text-[#1A1E1A] tabular-nums">
                    {onTimeShare}%
                  </span>
                </div>
                <p className="text-xs text-[#465147] mt-0.5">
                  Rasio tepat waktu terhadap total log bulan berjalan
                </p>

                <div className="mt-4">
                  <div className="grid grid-cols-3 text-[11px] font-semibold text-[#465147] mb-1.5 tabular-nums">
                    <span>Tepat {onTimeShare}%</span>
                    <span className="text-center">Telat {lateShare}%</span>
                    <span className="text-right">Lainnya {otherShare}%</span>
                  </div>
                  <div className="h-7 rounded-full overflow-hidden flex gap-1 bg-[#EEF5EE] p-0.5">
                    <div
                      className="h-full rounded-full bg-[#347F2F]"
                      style={{ width: `${Math.max(8, onTimeShare)}%` }}
                    />
                    <div
                      className="h-full rounded-full bg-[#1F211E]"
                      style={{ width: `${Math.max(6, lateShare)}%` }}
                    />
                    <div
                      className="h-full rounded-full bg-[#8FA792]"
                      style={{ width: `${Math.max(6, otherShare)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Signature Charcoal Panel with stacked card edge effect */}
              <div className="relative pt-3 flex-1 flex flex-col">
                <div
                  aria-hidden="true"
                  className="mx-6 h-3 rounded-t-2xl bg-[#9AB19C]/55"
                />
                <div
                  aria-hidden="true"
                  className="mx-3 h-3 rounded-t-2xl bg-[#4E594F] -mt-1.5"
                />
                <div className="rounded-[28px] bg-[#1F211E] text-[#F6FAF6] p-5 shadow-lg -mt-1.5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="text-base font-bold">
                        {isAdmin ? "Persetujuan Atasan" : "Pengajuan Saya"}
                      </h2>
                      <span className="text-2xl font-bold tabular-nums text-[#F6FAF6]">
                        {isAdmin ? data.kpis.pendingTotal : combinedTasks.length}
                      </span>
                    </div>
                    <p className="text-xs text-[#C4D0C4] mt-0.5">
                      {isAdmin
                        ? "Antrean izin, sakit, cuti, dan lembur"
                        : "Status izin & lembur terbaru"}
                    </p>

                    {combinedTasks.length === 0 ? (
                      <div className="mt-5 rounded-2xl bg-white/8 border border-white/10 p-4 text-center">
                        <CheckCircleIcon className="w-7 h-7 text-[#68C164] mx-auto mb-2" />
                        <p className="text-sm font-semibold text-[#F6FAF6]">
                          {isAdmin
                            ? "Tidak ada pengajuan menunggu"
                            : "Belum ada riwayat pengajuan"}
                        </p>
                        <p className="text-xs text-[#C4D0C4] mt-1">
                          {isAdmin
                            ? "Semua permohonan izin dan lembur telah ditinjau."
                            : "Ajukan izin, cuti, atau lembur jika diperlukan."}
                        </p>
                      </div>
                    ) : (
                      <ul className="mt-4 space-y-2.5">
                        {combinedTasks.map((item) => (
                          <li
                            key={`${item.kind}-${item.id}`}
                            className="rounded-2xl bg-white/8 border border-white/10 p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#F6FAF6] truncate">
                                  {item.fullName}
                                </p>
                                <p className="text-[11px] text-[#C4D0C4] truncate">
                                  {item.code} | {item.title}
                                </p>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 uppercase ${
                                  item.status === "approved"
                                    ? "bg-[#E6F4E7] text-[#1D5420]"
                                    : item.status === "rejected"
                                      ? "bg-[#FEE2E2] text-[#991B1B]"
                                      : "bg-[#FEF3C7] text-[#92400E]"
                                }`}
                              >
                                {item.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#D7E2D7] line-clamp-2">
                              {item.subtitle}
                            </p>
                            {isAdmin && item.status === "pending" && (
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReviewTarget({
                                      kind: item.kind,
                                      id: item.id,
                                      code: item.code,
                                      fullName: item.fullName,
                                      summary: item.title,
                                      decision: "approved",
                                    })
                                  }
                                  className="flex-1 min-h-[34px] rounded-full bg-[#347F2F] text-white text-xs font-semibold hover:bg-[#2a6826]"
                                >
                                  Setujui
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReviewTarget({
                                      kind: item.kind,
                                      id: item.id,
                                      code: item.code,
                                      fullName: item.fullName,
                                      summary: item.title,
                                      decision: "rejected",
                                    })
                                  }
                                  className="flex-1 min-h-[34px] rounded-full bg-white/12 text-[#F6FAF6] text-xs font-semibold hover:bg-[#991B1B]"
                                >
                                  Tolak
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <Link
                    href="/pengajuan"
                    className="min-h-[44px] w-full rounded-full bg-white text-[#1A1E1A] text-xs sm:text-sm font-semibold flex items-center justify-center hover:bg-[#EAF4EA]"
                  >
                    Buka Menu Izin & Lembur -&gt;
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* Admin Quick Approval Confirmation Modal */}
      <Modal
        open={Boolean(reviewTarget)}
        onClose={() => {
          if (!submittingReview) {
            setReviewTarget(null);
            setReviewNote("");
          }
        }}
        title={
          reviewTarget?.decision === "approved"
            ? `Setujui ${reviewTarget.code}`
            : `Tolak ${reviewTarget?.code ?? ""}`
        }
      >
        {reviewTarget && (
          <form onSubmit={handleConfirmReview} className="space-y-4">
            <div className="rounded-2xl bg-[#F3F8F3] border border-[#D4E4D5] p-3.5 text-sm">
              <p className="font-semibold text-[#1A1E1A]">
                {reviewTarget.fullName}
              </p>
              <p className="text-xs text-[#465147] mt-0.5">
                {reviewTarget.summary}
              </p>
            </div>
            <div>
              <label
                htmlFor="dash-review-note"
                className="block text-sm font-semibold text-[#1A1E1A] mb-1.5"
              >
                Catatan Atasan (opsional)
              </label>
              <textarea
                id="dash-review-note"
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Tambahkan catatan persetujuan atau alasan penolakan..."
                className="w-full rounded-2xl border border-[#7A8F7C] bg-white px-3.5 py-2.5 text-sm text-[#1A1E1A]"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submittingReview}
                onClick={() => {
                  setReviewTarget(null);
                  setReviewNote("");
                }}
                className="min-h-[44px] px-4 rounded-full border border-[#7A8F7C] text-sm font-semibold text-[#1A1E1A]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submittingReview}
                className={`min-h-[44px] px-5 rounded-full text-sm font-semibold text-white disabled:opacity-50 ${
                  reviewTarget.decision === "approved"
                    ? "bg-[#246326] hover:bg-[#1b4e1d]"
                    : "bg-[#991B1B] hover:bg-[#7F1D1D]"
                }`}
              >
                {submittingReview
                  ? "Menyimpan..."
                  : reviewTarget.decision === "approved"
                    ? "Konfirmasi Setujui"
                    : "Konfirmasi Tolak"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
