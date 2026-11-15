"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { SafeUser } from "@/lib/auth";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  downloadAttendanceExcel,
  downloadAttendancePdf,
} from "@/lib/export-reports";
import type {
  DailyAttendanceRow,
  KopSuratMeta,
  PayrollSummaryRow,
} from "@/lib/report-types";
import { formatMinutesAsHours, formatRupiah, getWibParts } from "@/lib/time";
import { AppShell } from "./AppShell";
import { useDataCache } from "./DataCacheContext";
import { useToast } from "./ToastContext";
import { Modal } from "./Modal";
import {
  DownloadIcon,
  EyeIcon,
  FileSpreadsheetIcon,
  SlidersIcon,
} from "./Icons";

interface ReportsPayload {
  startDate: string;
  endDate: string;
  summaryRows: PayrollSummaryRow[];
  dailyLogs: DailyAttendanceRow[];
  totalLogs: number;
  page: number;
  totalPages: number;
  kopSurat: KopSuratMeta;
}

export function RekapClient({ initialUser }: { initialUser: SafeUser }) {
  const { invalidatePrefix } = useDataCache();
  const { showToast } = useToast();
  const defaultMonth = useMemo(() => getWibParts().workDate.slice(0, 7), []);

  const [month, setMonth] = useState(defaultMonth);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const cacheKey = useMemo(
    () =>
      `reports:m=${month}&sd=${customStart}&ed=${customEnd}&q=${q}&s=${statusFilter}&p=${page}`,
    [customEnd, customStart, month, page, q, statusFilter]
  );

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [inspectLog, setInspectLog] = useState<DailyAttendanceRow | null>(null);

  const buildQueryParams = useCallback(
    (exportAll: boolean) => {
      const params = new URLSearchParams({
        month,
        q,
        status: statusFilter,
        page: String(page),
        limit: "15",
      });
      if (customStart && customEnd) {
        params.set("startDate", customStart);
        params.set("endDate", customEnd);
      }
      if (exportAll) {
        params.set("exportAll", "true");
      }
      return params;
    },
    [customEnd, customStart, month, page, q, statusFilter]
  );

  const reportUrl = useMemo(
    () => `/api/reports?${buildQueryParams(false).toString()}`,
    [buildQueryParams]
  );

  const {
    data: payload,
    loading,
    errorMsg,
    refetch: loadReports,
  } = useCachedQuery<ReportsPayload>(
    cacheKey,
    reportUrl,
    "Gagal memuat data rekap."
  );

  async function fetchFullExportDataset(): Promise<ReportsPayload> {
    const params = buildQueryParams(true);
    const res = await fetch(`/api/reports?${params.toString()}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Gagal mengambil data penuh untuk ekspor.");
    }
    return json as ReportsPayload;
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      const fullData = await fetchFullExportDataset();
      const periodLabel = `${fullData.startDate} s/d ${fullData.endDate}`;
      downloadAttendancePdf({
        summaryRows: fullData.summaryRows,
        dailyLogs: fullData.dailyLogs,
        kopSurat: fullData.kopSurat,
        periodLabel,
      });
      showToast("Laporan PDF dengan Kop Surat berhasil diunduh.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal membuat file PDF.",
        "error"
      );
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      const fullData = await fetchFullExportDataset();
      const periodLabel = `${fullData.startDate} s/d ${fullData.endDate}`;
      await downloadAttendanceExcel({
        summaryRows: fullData.summaryRows,
        dailyLogs: fullData.dailyLogs,
        kopSurat: fullData.kopSurat,
        periodLabel,
      });
      showToast("File Excel (.xlsx) berhasil diunduh.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal membuat file Excel.",
        "error"
      );
    } finally {
      setExportingExcel(false);
    }
  }

  const totalNetPayroll = useMemo(() => {
    if (!payload) return 0;
    return payload.summaryRows.reduce((s, r) => s + r.estimatedNetSalary, 0);
  }, [payload]);

  const totalLatePenalty = useMemo(() => {
    if (!payload) return 0;
    return payload.summaryRows.reduce((s, r) => s + r.totalPenalty, 0);
  }, [payload]);

  const totalOvertimePay = useMemo(() => {
    if (!payload) return 0;
    return payload.summaryRows.reduce((s, r) => s + r.totalOvertimePay, 0);
  }, [payload]);

  return (
    <AppShell
      user={initialUser}
      companyName={payload?.kopSurat.companyName ?? "TalentaZ 2.0"}
      onRefresh={() => {
        invalidatePrefix("reports");
        void loadReports();
      }}
    >
      <div className="space-y-6">
        {/* Title & Export Controls */}
        <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1E1A]">
              Rekap Absensi, Potongan Telat & Ekspor
            </h1>
            <p className="text-xs sm:text-sm text-[#465147] mt-0.5">
              Kalkulasi otomatis keterlambatan, lembur disetujui, estimasi gaji bersih, dan ekspor PDF Kop Surat atau Excel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={exportingPdf || loading}
              onClick={() => void handleExportPdf()}
              className="min-h-[44px] px-5 rounded-full bg-[#1F211E] text-[#F6FAF6] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 hover:bg-black disabled:opacity-50"
            >
              <DownloadIcon className="w-4 h-4" />
              <span>{exportingPdf ? "Membuat PDF..." : "Download PDF (Kop Surat)"}</span>
            </button>

            <button
              type="button"
              disabled={exportingExcel || loading}
              onClick={() => void handleExportExcel()}
              className="min-h-[44px] px-5 rounded-full bg-[#246326] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#1b4e1d] disabled:opacity-50"
            >
              <FileSpreadsheetIcon className="w-4 h-4" />
              <span>{exportingExcel ? "Membuat Excel..." : "Download Excel (.xlsx)"}</span>
            </button>
          </div>
        </section>

        {/* Kop Surat Preview Strip */}
        {payload?.kopSurat && (
          <section className="rounded-[24px] bg-white/90 border border-[#D4E4D5] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {payload.kopSurat.logoDataUrl ? (
                <img
                  src={payload.kopSurat.logoDataUrl}
                  alt={`Logo ${payload.kopSurat.companyName}`}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-xl object-contain border border-[#DCEADC] bg-white shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[#EAF4EA] text-[#1D5420] flex items-center justify-center font-bold text-sm shrink-0">
                  KOP
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1A1E1A] truncate">
                  {payload.kopSurat.companyName}
                </p>
                <p className="text-xs text-[#465147] truncate">
                  {payload.kopSurat.companyAddress} | {payload.kopSurat.companyContact}
                </p>
              </div>
            </div>
            {initialUser.role === "admin" && (
              <Link
                href="/pengaturan"
                className="min-h-[38px] px-4 rounded-full bg-[#F3F8F3] border border-[#7A8F7C] text-xs font-semibold text-[#1A1E1A] inline-flex items-center gap-1.5 hover:bg-[#E6F4E7] self-start sm:self-auto shrink-0"
              >
                <SlidersIcon className="w-3.5 h-3.5" />
                <span>Ubah Kop Surat</span>
              </Link>
            )}
          </section>
        )}

        {/* Filter Bar + Summary Metric Strips */}
        <section className="rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQ(searchInput.trim());
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
          >
            <div>
              <label
                htmlFor="rekap-month"
                className="block text-xs font-semibold text-[#1A1E1A] mb-1"
              >
                Bulan Periode
              </label>
              <input
                id="rekap-month"
                type="month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setCustomStart("");
                  setCustomEnd("");
                  setPage(1);
                }}
                className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3 text-xs sm:text-sm text-[#1A1E1A]"
              />
            </div>

            <div>
              <label
                htmlFor="rekap-start"
                className="block text-xs font-semibold text-[#1A1E1A] mb-1"
              >
                Dari Tanggal (opsional)
              </label>
              <input
                id="rekap-start"
                type="date"
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setPage(1);
                }}
                className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3 text-xs sm:text-sm text-[#1A1E1A]"
              />
            </div>

            <div>
              <label
                htmlFor="rekap-end"
                className="block text-xs font-semibold text-[#1A1E1A] mb-1"
              >
                Sampai Tanggal
              </label>
              <input
                id="rekap-end"
                type="date"
                value={customEnd}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setPage(1);
                }}
                className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3 text-xs sm:text-sm text-[#1A1E1A]"
              />
            </div>

            <div>
              <label
                htmlFor="rekap-status"
                className="block text-xs font-semibold text-[#1A1E1A] mb-1"
              >
                Filter Status Log
              </label>
              <select
                id="rekap-status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3 text-xs sm:text-sm text-[#1A1E1A]"
              >
                <option value="all">Semua Log</option>
                <option value="ontime">Tepat Waktu</option>
                <option value="late">Terlambat</option>
                <option value="outside">Luar Radius</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex items-end gap-2">
              <div className="flex-1">
                <label
                  htmlFor="rekap-search"
                  className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                >
                  Cari Karyawan / Kode
                </label>
                <input
                  id="rekap-search"
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Nama, kode EMP/ABS..."
                  className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-xs sm:text-sm text-[#1A1E1A]"
                />
              </div>
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-full bg-[#1F211E] text-[#F6FAF6] text-xs sm:text-sm font-semibold hover:bg-black shrink-0"
              >
                Terapkan
              </button>
            </div>
          </form>

          {payload && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-2xl bg-[#F3F8F3] border border-[#DCEADC] p-4">
                <p className="text-xs text-[#465147]">Total Potongan Telat</p>
                <p className="text-xl font-bold text-[#991B1B] tabular-nums mt-0.5">
                  -{formatRupiah(totalLatePenalty)}
                </p>
              </div>
              <div className="rounded-2xl bg-[#F3F8F3] border border-[#DCEADC] p-4">
                <p className="text-xs text-[#465147]">Total Uang Lembur</p>
                <p className="text-xl font-bold text-[#1D5420] tabular-nums mt-0.5">
                  +{formatRupiah(totalOvertimePay)}
                </p>
              </div>
              <div className="rounded-2xl bg-[#1F211E] text-[#F6FAF6] p-4">
                <p className="text-xs text-[#C4D0C4]">
                  Total Estimasi Gaji Bersih ({payload.startDate} s/d {payload.endDate})
                </p>
                <p className="text-xl font-bold tabular-nums mt-0.5">
                  {formatRupiah(totalNetPayroll)}
                </p>
              </div>
            </div>
          )}
        </section>

        {loading ? (
          <div className="space-y-4">
            <div className="h-44 rounded-[28px] bg-white/80 animate-pulse" />
            <div className="h-64 rounded-[28px] bg-white/80 animate-pulse" />
          </div>
        ) : errorMsg ? (
          <div className="rounded-[28px] bg-[#FEE2E2] p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-[#991B1B]">{errorMsg}</p>
            <button
              type="button"
              onClick={() => void loadReports()}
              className="min-h-[42px] px-5 rounded-full bg-[#991B1B] text-white text-xs font-semibold"
            >
              Muat Ulang Rekap
            </button>
          </div>
        ) : payload ? (
          <>
            {/* Payroll Summary Table */}
            <section className="rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#1A1E1A]">
                  Ringkasan Kehadiran & Penggajian Karyawan
                </h2>
                <p className="text-xs text-[#465147]">
                  Periode {payload.startDate} hingga {payload.endDate}
                </p>
              </div>

              {payload.summaryRows.length === 0 ? (
                <div className="rounded-2xl bg-[#F3F8F3] border border-dashed border-[#B7CEB8] p-6 text-center text-sm text-[#465147]">
                  Tidak ada karyawan yang cocok dengan kata kunci pencarian.
                </div>
              ) : (
                <>
                  {/* Mobile Summary Cards */}
                  <div className="grid grid-cols-1 gap-3 md:hidden">
                    {payload.summaryRows.map((row) => (
                      <div
                        key={row.userId}
                        className="rounded-2xl bg-[#F6FAF6] border border-[#DCEADC] p-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-[#1A1E1A]">
                              {row.fullName}
                            </p>
                            <p className="text-xs text-[#465147]">
                              {row.employeeCode} | {row.position}
                            </p>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#E6F4E7] text-[#1D5420] text-xs font-bold tabular-nums">
                            Hadir {row.presentDays} hr
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-xs text-[#465147] tabular-nums">
                          <span>Telat: {row.lateCount}x ({row.lateMinutesTotal}m)</span>
                          <span>Luar Radius: {row.outsideCount}x</span>
                          <span>Izin Disetujui: {row.approvedLeaveDays} hr</span>
                          <span>Lembur: {formatMinutesAsHours(row.approvedOvertimeMinutes)}j</span>
                        </div>
                        <div className="pt-2 border-t border-[#DCEADC] flex items-center justify-between text-xs tabular-nums">
                          <span className="text-[#991B1B] font-semibold">
                            Potongan: -{formatRupiah(row.totalPenalty)}
                          </span>
                          <span className="text-sm font-bold text-[#1A1E1A]">
                            Bersih: {formatRupiah(row.estimatedNetSalary)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Summary Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#DCEADC] text-[11px] font-bold uppercase tracking-wider text-[#465147]">
                          <th className="py-3 px-3">Karyawan</th>
                          <th className="py-3 px-3 text-center">Hadir</th>
                          <th className="py-3 px-3 text-center">Telat</th>
                          <th className="py-3 px-3 text-center">Luar Radius</th>
                          <th className="py-3 px-3 text-center">Izin/Cuti</th>
                          <th className="py-3 px-3 text-center">Lembur</th>
                          <th className="py-3 px-3 text-right">Gaji Pokok</th>
                          <th className="py-3 px-3 text-right">Potongan</th>
                          <th className="py-3 px-3 text-right">Uang Lembur</th>
                          <th className="py-3 px-3 text-right">Est. Gaji Bersih</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEF5EE] text-xs sm:text-sm">
                        {payload.summaryRows.map((row) => (
                          <tr key={row.userId} className="hover:bg-[#F5FAF5]">
                            <td className="py-3 px-3">
                              <div className="font-semibold text-[#1A1E1A]">
                                {row.fullName}
                              </div>
                              <div className="text-xs text-[#465147]">
                                {row.employeeCode} | {row.position}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-semibold tabular-nums">
                              {row.presentDays} hr
                            </td>
                            <td className="py-3 px-3 text-center tabular-nums">
                              <span
                                className={
                                  row.lateCount > 0
                                    ? "px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] font-semibold text-xs"
                                    : "text-[#465147]"
                                }
                              >
                                {row.lateCount}x ({row.lateMinutesTotal}m)
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center tabular-nums">
                              {row.outsideCount}x
                            </td>
                            <td className="py-3 px-3 text-center tabular-nums">
                              {row.approvedLeaveDays} hr
                            </td>
                            <td className="py-3 px-3 text-center tabular-nums">
                              {formatMinutesAsHours(row.approvedOvertimeMinutes)} j
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums">
                              {formatRupiah(row.baseSalary)}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-[#991B1B] font-semibold">
                              -{formatRupiah(row.totalPenalty)}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-[#1D5420] font-semibold">
                              +{formatRupiah(row.totalOvertimePay)}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums font-bold text-[#1A1E1A]">
                              {formatRupiah(row.estimatedNetSalary)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            {/* Daily Logs Table */}
            <section className="rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#1A1E1A]">
                  Log Harian Absensi & Alasan ({payload.totalLogs} catatan)
                </h2>
                <p className="text-xs text-[#465147]">
                  Semua catatan beserta alasan telat dan luar radius yang masuk ke laporan PDF & Excel.
                </p>
              </div>

              {payload.dailyLogs.length === 0 ? (
                <div className="rounded-2xl bg-[#F3F8F3] border border-dashed border-[#B7CEB8] p-6 text-center text-sm text-[#465147]">
                  Belum ada catatan absensi harian pada periode ini.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#DCEADC] text-[11px] font-bold uppercase tracking-wider text-[#465147]">
                          <th className="py-3 px-3">Kode / Tgl</th>
                          <th className="py-3 px-3">Karyawan</th>
                          <th className="py-3 px-3">Masuk - Pulang</th>
                          <th className="py-3 px-3">Alasan / Catatan</th>
                          <th className="py-3 px-3 text-right">Potongan</th>
                          <th className="py-3 px-3 text-right">Foto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEF5EE] text-xs sm:text-sm">
                        {payload.dailyLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-[#F5FAF5]">
                            <td className="py-3 px-3 tabular-nums">
                              <div className="font-semibold text-[#1A1E1A]">
                                {log.attendanceCode}
                              </div>
                              <div className="text-xs text-[#465147]">
                                {log.workDate}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-[#1A1E1A]">
                                {log.fullName}
                              </div>
                              <div className="text-xs text-[#465147]">
                                Jarak:{" "}
                                {log.clockInDistanceMeters !== null
                                  ? `${log.clockInDistanceMeters} m`
                                  : "-"}
                              </div>
                            </td>
                            <td className="py-3 px-3 tabular-nums">
                              <div>
                                {log.clockInTime} - {log.clockOutTime} WIB
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    log.isLate
                                      ? "bg-[#FEF3C7] text-[#92400E]"
                                      : "bg-[#E6F4E7] text-[#1D5420]"
                                  }`}
                                >
                                  {log.isLate ? `Telat ${log.lateMinutes}m` : "Tepat"}
                                </span>
                                {(log.isOutsideIn || log.isOutsideOut) && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEE2E2] text-[#991B1B]">
                                    Luar Radius
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 max-w-xs text-xs text-[#465147]">
                              {log.lateReason && (
                                <p>
                                  <strong className="text-[#92400E]">Telat:</strong>{" "}
                                  {log.lateReason}
                                </p>
                              )}
                              {log.outsideInReason && (
                                <p>
                                  <strong className="text-[#991B1B]">
                                    Luar (Masuk):
                                  </strong>{" "}
                                  {log.outsideInReason}
                                </p>
                              )}
                              {log.outsideOutReason && (
                                <p>
                                  <strong className="text-[#991B1B]">
                                    Luar (Pulang):
                                  </strong>{" "}
                                  {log.outsideOutReason}
                                </p>
                              )}
                              {!log.lateReason &&
                                !log.outsideInReason &&
                                !log.outsideOutReason && <span>-</span>}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums font-semibold text-[#991B1B]">
                              {log.penaltyAmount > 0
                                ? formatRupiah(log.penaltyAmount)
                                : "-"}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setInspectLog(log)}
                                className="min-h-[36px] px-3 rounded-full bg-[#F3F8F3] border border-[#7A8F7C] text-xs font-semibold text-[#1A1E1A] inline-flex items-center gap-1 hover:bg-[#E6F4E7]"
                              >
                                <EyeIcon className="w-3.5 h-3.5" />
                                <span>Foto</span>
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
                      Halaman {payload.page} dari {payload.totalPages} ({payload.totalLogs} log)
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
          </>
        ) : null}
      </div>

      {/* Selfie Inspection Modal */}
      <Modal
        open={Boolean(inspectLog)}
        onClose={() => setInspectLog(null)}
        title={`Bukti Selfie ${inspectLog?.attendanceCode ?? ""}`}
        maxWidthClass="max-w-2xl"
      >
        {inspectLog && (
          <div className="space-y-4">
            <p className="text-xs text-[#465147]">
              <strong>{inspectLog.fullName}</strong> ({inspectLog.employeeCode}) |{" "}
              {inspectLog.workDate} | {inspectLog.clockInTime} -{" "}
              {inspectLog.clockOutTime} WIB
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-[#1A1E1A]">Selfie Masuk</p>
                {inspectLog.clockInPhoto ? (
                  <img
                    src={inspectLog.clockInPhoto}
                    alt={`Selfie masuk ${inspectLog.fullName}`}
                    width={640}
                    height={480}
                    className="w-full rounded-2xl border border-[#DCEADC] object-cover"
                  />
                ) : (
                  <div className="h-36 rounded-2xl bg-[#F3F8F3] flex items-center justify-center text-xs text-[#465147]">
                    Tidak ada foto
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-[#1A1E1A]">Selfie Pulang</p>
                {inspectLog.clockOutPhoto ? (
                  <img
                    src={inspectLog.clockOutPhoto}
                    alt={`Selfie pulang ${inspectLog.fullName}`}
                    width={640}
                    height={480}
                    className="w-full rounded-2xl border border-[#DCEADC] object-cover"
                  />
                ) : (
                  <div className="h-36 rounded-2xl bg-[#F3F8F3] flex items-center justify-center text-xs text-[#465147]">
                    Belum absen pulang
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
