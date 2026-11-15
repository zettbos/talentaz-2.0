"use client";

import React, { useMemo, useState } from "react";
import type { SafeUser } from "@/lib/auth";
import { useCachedQuery } from "@/lib/use-cached-query";
import { compressAttachmentFile } from "@/lib/media-client";
import {
  computeDurationMinutes,
  formatMinutesAsHours,
  formatRupiah,
  getWibParts,
} from "@/lib/time";
import { AppShell } from "./AppShell";
import { useDataCache } from "./DataCacheContext";
import { useToast } from "./ToastContext";
import { Modal } from "./Modal";
import {
  CheckCircleIcon,
  ClipboardCheckIcon,
  ClockIcon,
  DownloadIcon,
  EyeIcon,
  PlusIcon,
  UploadIcon,
  XIcon,
} from "./Icons";

interface LeaveRequestRow {
  id: number;
  requestCode: string;
  userId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  leaveType: "izin" | "sakit" | "cuti" | string;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentDataUrl: string | null;
  status: "pending" | "approved" | "rejected" | string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface LeaveListPayload {
  requests: LeaveRequestRow[];
  total: number;
  page: number;
  totalPages: number;
  nextRequestCode: string;
}

interface OvertimeRequestRow {
  id: number;
  overtimeCode: string;
  userId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  overtimeDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  taskDescription: string;
  estimatedPay: number;
  status: "pending" | "approved" | "rejected" | string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface OvertimeListPayload {
  requests: OvertimeRequestRow[];
  total: number;
  page: number;
  totalPages: number;
  nextOvertimeCode: string;
  overtimeHourlyRate: number;
}

export function PengajuanClient({ initialUser }: { initialUser: SafeUser }) {
  const { invalidatePrefix } = useDataCache();
  const { showToast } = useToast();
  const isAdmin = initialUser.role === "admin";
  const wibToday = useMemo(() => getWibParts().workDate, []);

  const [activeTab, setActiveTab] = useState<"leave" | "overtime">("leave");

  // Leave filter & data state.
  const [leaveSearchInput, setLeaveSearchInput] = useState("");
  const [leaveQ, setLeaveQ] = useState("");
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const [leavePage, setLeavePage] = useState(1);

  const leaveCacheKey = useMemo(
    () =>
      `leaves:q=${leaveQ}&s=${leaveStatusFilter}&t=${leaveTypeFilter}&p=${leavePage}`,
    [leavePage, leaveQ, leaveStatusFilter, leaveTypeFilter]
  );
  const leaveUrl = useMemo(
    () =>
      `/api/leaves?${new URLSearchParams({
        q: leaveQ,
        status: leaveStatusFilter,
        leaveType: leaveTypeFilter,
        page: String(leavePage),
        limit: "10",
      }).toString()}`,
    [leavePage, leaveQ, leaveStatusFilter, leaveTypeFilter]
  );

  const {
    data: leaveData,
    loading: leaveLoading,
    errorMsg: leaveError,
    refetch: loadLeaves,
  } = useCachedQuery<LeaveListPayload>(
    leaveCacheKey,
    leaveUrl,
    "Gagal memuat data izin/cuti."
  );

  // Leave create form state.
  const [leaveType, setLeaveType] = useState<"izin" | "sakit" | "cuti">("izin");
  const [startDate, setStartDate] = useState(wibToday);
  const [endDate, setEndDate] = useState(wibToday);
  const [leaveReason, setLeaveReason] = useState("");
  const [attachment, setAttachment] = useState<{
    name: string;
    mime: string;
    dataUrl: string;
  } | null>(null);
  const [compressingAttachment, setCompressingAttachment] = useState(false);
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Overtime filter & data state.
  const [otSearchInput, setOtSearchInput] = useState("");
  const [otQ, setOtQ] = useState("");
  const [otStatusFilter, setOtStatusFilter] = useState("all");
  const [otPage, setOtPage] = useState(1);

  const otCacheKey = useMemo(
    () => `overtimes:q=${otQ}&s=${otStatusFilter}&p=${otPage}`,
    [otPage, otQ, otStatusFilter]
  );
  const otUrl = useMemo(
    () =>
      `/api/overtimes?${new URLSearchParams({
        q: otQ,
        status: otStatusFilter,
        page: String(otPage),
        limit: "10",
      }).toString()}`,
    [otPage, otQ, otStatusFilter]
  );

  const {
    data: otData,
    loading: otLoading,
    errorMsg: otError,
    refetch: loadOvertimes,
  } = useCachedQuery<OvertimeListPayload>(
    otCacheKey,
    otUrl,
    "Gagal memuat data lembur."
  );

  // Overtime create form state.
  const [overtimeDate, setOvertimeDate] = useState(wibToday);
  const [otStartTime, setOtStartTime] = useState("17:30");
  const [otEndTime, setOtEndTime] = useState("19:30");
  const [taskDescription, setTaskDescription] = useState("");
  const [submittingOt, setSubmittingOt] = useState(false);

  // Modals: Attachment Preview, Admin Review, Cancel Confirmation.
  const [previewLeave, setPreviewLeave] = useState<LeaveRequestRow | null>(null);
  const [reviewAction, setReviewAction] = useState<{
    kind: "leave" | "overtime";
    id: number;
    code: string;
    fullName: string;
    summary: string;
    decision: "approved" | "rejected";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<{
    kind: "leave" | "overtime";
    id: number;
    code: string;
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function handleSelectAttachment(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressingAttachment(true);
    try {
      const result = await compressAttachmentFile(file);
      setAttachment(result);
      showToast(`Lampiran "${result.name}" siap dikirim.`, "info");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal memproses lampiran.",
        "error"
      );
      e.target.value = "";
    } finally {
      setCompressingAttachment(false);
    }
  }

  async function handleCreateLeave(e: React.FormEvent) {
    e.preventDefault();
    if (leaveReason.trim().length < 5) {
      showToast("Alasan izin/cuti minimal 5 karakter.", "error");
      return;
    }
    setSubmittingLeave(true);
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveType,
          startDate,
          endDate,
          reason: leaveReason.trim(),
          attachmentName: attachment?.name ?? null,
          attachmentMime: attachment?.mime ?? null,
          attachmentDataUrl: attachment?.dataUrl ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal mengirim pengajuan.");
      }

      showToast(
        `Pengajuan ${json.request?.requestCode ?? ""} berhasil dikirim.`,
        "success"
      );
      setLeaveReason("");
      setAttachment(null);
      setLeavePage(1);
      invalidatePrefix("leaves");
      invalidatePrefix("dashboard");
      invalidatePrefix("reports");
      await loadLeaves();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal mengirim pengajuan.",
        "error"
      );
    } finally {
      setSubmittingLeave(false);
    }
  }

  const liveOtDuration = useMemo(
    () => computeDurationMinutes(otStartTime, otEndTime),
    [otEndTime, otStartTime]
  );
  const hourlyRate = otData?.overtimeHourlyRate ?? 25000;
  const liveOtEstimate = useMemo(
    () => Math.round((liveOtDuration / 60) * hourlyRate),
    [hourlyRate, liveOtDuration]
  );

  async function handleCreateOvertime(e: React.FormEvent) {
    e.preventDefault();
    if (taskDescription.trim().length < 5) {
      showToast("Uraian pekerjaan lembur minimal 5 karakter.", "error");
      return;
    }
    if (liveOtDuration < 15 || liveOtDuration > 720) {
      showToast("Durasi lembur harus antara 15 menit hingga 12 jam.", "error");
      return;
    }
    setSubmittingOt(true);
    try {
      const res = await fetch("/api/overtimes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overtimeDate,
          startTime: otStartTime,
          endTime: otEndTime,
          taskDescription: taskDescription.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal mengirim pengajuan lembur.");
      }

      showToast(
        `Lembur ${json.request?.overtimeCode ?? ""} berhasil diajukan.`,
        "success"
      );
      setTaskDescription("");
      setOtPage(1);
      invalidatePrefix("overtimes");
      invalidatePrefix("dashboard");
      invalidatePrefix("reports");
      await loadOvertimes();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal mengirim lembur.",
        "error"
      );
    } finally {
      setSubmittingOt(false);
    }
  }

  async function handleConfirmReview(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewAction) return;
    setSubmittingReview(true);
    try {
      const endpoint =
        reviewAction.kind === "leave"
          ? `/api/leaves/${reviewAction.id}`
          : `/api/overtimes/${reviewAction.id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: reviewAction.decision,
          reviewNote: reviewNote.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal memproses persetujuan.");
      }

      showToast(
        `${reviewAction.code} telah ${
          reviewAction.decision === "approved" ? "disetujui" : "ditolak"
        }.`,
        "success"
      );
      setReviewAction(null);
      setReviewNote("");
      invalidatePrefix("leaves");
      invalidatePrefix("overtimes");
      invalidatePrefix("dashboard");
      invalidatePrefix("reports");
      if (reviewAction.kind === "leave") await loadLeaves();
      else await loadOvertimes();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal menyimpan persetujuan.",
        "error"
      );
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const endpoint =
        cancelTarget.kind === "leave"
          ? `/api/leaves/${cancelTarget.id}`
          : `/api/overtimes/${cancelTarget.id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal membatalkan pengajuan.");
      }

      showToast(`${cancelTarget.code} berhasil dibatalkan.`, "info");
      setCancelTarget(null);
      invalidatePrefix("leaves");
      invalidatePrefix("overtimes");
      invalidatePrefix("dashboard");
      invalidatePrefix("reports");
      if (cancelTarget.kind === "leave") await loadLeaves();
      else await loadOvertimes();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal membatalkan pengajuan.",
        "error"
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <AppShell
      user={initialUser}
      onRefresh={() => {
        invalidatePrefix("leaves");
        invalidatePrefix("overtimes");
        void loadLeaves();
        void loadOvertimes();
      }}
    >
      <div className="space-y-6">
        {/* Header & Tab Bar */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1E1A]">
              Pengajuan Izin, Cuti & Lembur
            </h1>
            <p className="text-xs sm:text-sm text-[#465147] mt-0.5">
              {isAdmin
                ? "Tinjau lampiran surat sakit/izin, kalkulasi uang lembur, dan berikan persetujuan atasan."
                : "Ajukan izin, sakit, cuti dengan lampiran bukti, atau ajukan jam lembur ke atasan."}
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Kategori pengajuan"
            className="inline-flex rounded-full bg-white/90 border border-[#D4E4D5] p-1 self-start sm:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "leave"}
              onClick={() => setActiveTab("leave")}
              className={`min-h-[40px] px-4 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === "leave"
                  ? "bg-[#1F211E] text-[#F6FAF6]"
                  : "text-[#465147] hover:text-[#1A1E1A]"
              }`}
            >
              Izin / Sakit / Cuti
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "overtime"}
              onClick={() => setActiveTab("overtime")}
              className={`min-h-[40px] px-4 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === "overtime"
                  ? "bg-[#1F211E] text-[#F6FAF6]"
                  : "text-[#465147] hover:text-[#1A1E1A]"
              }`}
            >
              Lembur Karyawan
            </button>
          </div>
        </section>

        {activeTab === "leave" ? (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Form: Ajukan Izin/Sakit/Cuti */}
            <form
              onSubmit={handleCreateLeave}
              className="lg:col-span-4 rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-[#1A1E1A] flex items-center gap-2">
                  <PlusIcon className="w-4 h-4 text-[#246326]" />
                  <span>Buat Pengajuan Baru</span>
                </h2>
                <span className="px-2.5 py-1 rounded-full bg-[#EAF4EA] text-[#1D5420] text-[11px] font-bold tabular-nums">
                  {leaveData?.nextRequestCode ?? "IZN-..."}
                </span>
              </div>

              <div>
                <label
                  htmlFor="leave-type"
                  className="block text-xs font-semibold text-[#1A1E1A] mb-1.5"
                >
                  Jenis Pengajuan
                </label>
                <select
                  id="leave-type"
                  value={leaveType}
                  onChange={(e) =>
                    setLeaveType(e.target.value as "izin" | "sakit" | "cuti")
                  }
                  className="w-full min-h-[44px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A]"
                >
                  <option value="izin">Izin Keperluan</option>
                  <option value="sakit">Sakit</option>
                  <option value="cuti">Cuti Tahunan / Khusus</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="leave-start"
                    className="block text-xs font-semibold text-[#1A1E1A] mb-1.5"
                  >
                    Tanggal Mulai
                  </label>
                  <input
                    id="leave-start"
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full min-h-[44px] rounded-2xl border border-[#7A8F7C] bg-white px-3 text-xs sm:text-sm text-[#1A1E1A]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="leave-end"
                    className="block text-xs font-semibold text-[#1A1E1A] mb-1.5"
                  >
                    Tanggal Selesai
                  </label>
                  <input
                    id="leave-end"
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full min-h-[44px] rounded-2xl border border-[#7A8F7C] bg-white px-3 text-xs sm:text-sm text-[#1A1E1A]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="leave-reason"
                  className="block text-xs font-semibold text-[#1A1E1A] mb-1.5"
                >
                  Keterangan / Alasan
                </label>
                <textarea
                  id="leave-reason"
                  rows={3}
                  required
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Jelaskan keperluan izin, keluhan sakit, atau rencana cuti..."
                  className="w-full rounded-2xl border border-[#7A8F7C] bg-white px-3.5 py-2.5 text-sm text-[#1A1E1A]"
                />
              </div>

              <div>
                <label
                  htmlFor="leave-attachment"
                  className="block text-xs font-semibold text-[#1A1E1A] mb-1.5"
                >
                  Lampiran Bukti (Foto / Surat Dokter PDF maks. 1 MB)
                </label>
                <div className="rounded-2xl border border-dashed border-[#7A8F7C] bg-[#F5FAF5] p-3.5 space-y-2.5">
                  <label
                    htmlFor="leave-attachment"
                    className="min-h-[40px] px-3.5 rounded-full bg-white border border-[#7A8F7C] text-xs font-semibold text-[#1A1E1A] inline-flex items-center gap-1.5 hover:bg-[#E6F4E7]"
                  >
                    <UploadIcon className="w-3.5 h-3.5" />
                    <span>
                      {compressingAttachment
                        ? "Mengompres lampiran..."
                        : attachment
                          ? "Ganti File Lampiran"
                          : "Pilih Foto / PDF"}
                    </span>
                  </label>
                  <input
                    id="leave-attachment"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleSelectAttachment}
                    className="sr-only"
                  />

                  {attachment && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-white border border-[#D4E4D5] p-2">
                      <span className="text-xs font-medium text-[#1A1E1A] truncate">
                        {attachment.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        aria-label="Hapus lampiran"
                        className="w-8 h-8 rounded-full hover:bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center shrink-0"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingLeave || compressingAttachment}
                className="w-full min-h-[46px] rounded-full bg-[#246326] text-white text-sm font-bold hover:bg-[#1b4e1d] disabled:opacity-50"
              >
                {submittingLeave ? "Mengirim..." : "Kirim Pengajuan Izin"}
              </button>
            </form>

            {/* Right Table/Cards: Leave List */}
            <div className="lg:col-span-8 rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base sm:text-lg font-bold text-[#1A1E1A]">
                  Daftar Pengajuan Izin / Sakit / Cuti
                </h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setLeavePage(1);
                    setLeaveQ(leaveSearchInput.trim());
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="search"
                    value={leaveSearchInput}
                    onChange={(e) => setLeaveSearchInput(e.target.value)}
                    placeholder="Cari nama/kode..."
                    aria-label="Cari pengajuan izin"
                    className="min-h-[40px] w-full sm:w-44 rounded-full border border-[#7A8F7C] bg-white px-3.5 text-xs text-[#1A1E1A]"
                  />
                  <select
                    value={leaveTypeFilter}
                    onChange={(e) => {
                      setLeavePage(1);
                      setLeaveTypeFilter(e.target.value);
                    }}
                    aria-label="Filter jenis izin"
                    className="min-h-[40px] rounded-full border border-[#7A8F7C] bg-white px-3 text-xs text-[#1A1E1A]"
                  >
                    <option value="all">Semua Jenis</option>
                    <option value="izin">Izin</option>
                    <option value="sakit">Sakit</option>
                    <option value="cuti">Cuti</option>
                  </select>
                  <select
                    value={leaveStatusFilter}
                    onChange={(e) => {
                      setLeavePage(1);
                      setLeaveStatusFilter(e.target.value);
                    }}
                    aria-label="Filter status izin"
                    className="min-h-[40px] rounded-full border border-[#7A8F7C] bg-white px-3 text-xs text-[#1A1E1A]"
                  >
                    <option value="all">Semua Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Disetujui</option>
                    <option value="rejected">Ditolak</option>
                  </select>
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 rounded-full bg-[#1F211E] text-[#F6FAF6] text-xs font-semibold"
                  >
                    Cari
                  </button>
                </form>
              </div>

              {leaveLoading ? (
                <div className="space-y-2.5">
                  <div className="h-16 rounded-2xl bg-[#EEF5EE] animate-pulse" />
                  <div className="h-16 rounded-2xl bg-[#EEF5EE] animate-pulse" />
                </div>
              ) : leaveError ? (
                <div className="rounded-2xl bg-[#FEE2E2] p-5 text-center space-y-2">
                  <p className="text-sm font-semibold text-[#991B1B]">
                    {leaveError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadLeaves()}
                    className="min-h-[40px] px-4 rounded-full bg-[#991B1B] text-white text-xs font-semibold"
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : !leaveData || leaveData.requests.length === 0 ? (
                <div className="rounded-2xl bg-[#F3F8F3] border border-dashed border-[#B7CEB8] p-6 text-center">
                  <ClipboardCheckIcon className="w-8 h-8 text-[#465147] mx-auto mb-2" />
                  <p className="text-sm font-semibold text-[#1A1E1A]">
                    Belum ada data izin, sakit, atau cuti
                  </p>
                  <p className="text-xs text-[#465147] mt-1">
                    Gunakan formulir di samping untuk mengajukan izin atau ubah filter pencarian.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaveData.requests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-2xl bg-[#F6FAF6] border border-[#DCEADC] p-4 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-[#1A1E1A] tabular-nums">
                              {req.requestCode}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#DCEADC] text-[11px] font-semibold uppercase text-[#1A1E1A]">
                              {req.leaveType}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase ${
                                req.status === "approved"
                                  ? "bg-[#E6F4E7] text-[#1D5420]"
                                  : req.status === "rejected"
                                    ? "bg-[#FEE2E2] text-[#991B1B]"
                                    : "bg-[#FEF3C7] text-[#92400E]"
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-[#1A1E1A] mt-1">
                            {req.fullName}{" "}
                            <span className="text-xs font-normal text-[#465147]">
                              ({req.employeeCode} | {req.position})
                            </span>
                          </p>
                        </div>

                        <span className="text-xs font-semibold text-[#465147] tabular-nums">
                          {req.startDate} s/d {req.endDate}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-[#1A1E1A]">
                        {req.reason}
                      </p>

                      {req.reviewNote && (
                        <p className="text-xs rounded-xl bg-white border border-[#DCEADC] px-3 py-2 text-[#465147]">
                          <strong>Catatan Atasan:</strong> {req.reviewNote}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div>
                          {req.attachmentDataUrl && (
                            <button
                              type="button"
                              onClick={() => setPreviewLeave(req)}
                              className="min-h-[38px] px-3.5 rounded-full bg-white border border-[#7A8F7C] text-xs font-semibold text-[#1A1E1A] inline-flex items-center gap-1.5 hover:bg-[#E6F4E7]"
                            >
                              <EyeIcon className="w-3.5 h-3.5" />
                              <span>Lihat Lampiran</span>
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {isAdmin && req.status === "pending" && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewAction({
                                    kind: "leave",
                                    id: req.id,
                                    code: req.requestCode,
                                    fullName: req.fullName,
                                    summary: `${req.leaveType.toUpperCase()} (${req.startDate} - ${req.endDate})`,
                                    decision: "approved",
                                  })
                                }
                                className="min-h-[38px] px-4 rounded-full bg-[#246326] text-white text-xs font-semibold hover:bg-[#1b4e1d]"
                              >
                                Setujui
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewAction({
                                    kind: "leave",
                                    id: req.id,
                                    code: req.requestCode,
                                    fullName: req.fullName,
                                    summary: `${req.leaveType.toUpperCase()} (${req.startDate} - ${req.endDate})`,
                                    decision: "rejected",
                                  })
                                }
                                className="min-h-[38px] px-4 rounded-full bg-[#991B1B] text-white text-xs font-semibold hover:bg-[#7F1D1D]"
                              >
                                Tolak
                              </button>
                            </>
                          )}
                          {req.status === "pending" &&
                            (req.userId === initialUser.id || isAdmin) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setCancelTarget({
                                    kind: "leave",
                                    id: req.id,
                                    code: req.requestCode,
                                  })
                                }
                                className="min-h-[38px] px-3.5 rounded-full border border-[#7A8F7C] bg-white text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2]"
                              >
                                Batalkan
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EEF5EE] text-xs text-[#465147]">
                    <span>
                      Halaman {leaveData.page} dari {leaveData.totalPages} ({leaveData.total} item)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={leaveData.page <= 1}
                        onClick={() => setLeavePage((p) => Math.max(1, p - 1))}
                        className="min-h-[38px] px-3.5 rounded-full border border-[#7A8F7C] bg-white text-[#1A1E1A] font-semibold disabled:opacity-45"
                      >
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        disabled={leaveData.page >= leaveData.totalPages}
                        onClick={() =>
                          setLeavePage((p) =>
                            Math.min(leaveData.totalPages, p + 1)
                          )
                        }
                        className="min-h-[38px] px-3.5 rounded-full border border-[#7A8F7C] bg-white text-[#1A1E1A] font-semibold disabled:opacity-45"
                      >
                        Berikutnya
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Form: Ajukan Lembur */}
            <form
              onSubmit={handleCreateOvertime}
              className="lg:col-span-4 rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-[#1A1E1A] flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-[#246326]" />
                  <span>Ajukan Lembur</span>
                </h2>
                <span className="px-2.5 py-1 rounded-full bg-[#EAF4EA] text-[#1D5420] text-[11px] font-bold tabular-nums">
                  {otData?.nextOvertimeCode ?? "LMB-..."}
                </span>
              </div>

              <div>
                <label
                  htmlFor="ot-date"
                  className="block text-xs font-semibold text-[#1A1E1A] mb-1.5"
                >
                  Tanggal Lembur
                </label>
                <input
                  id="ot-date"
                  type="date"
                  required
                  value={overtimeDate}
                  onChange={(e) => setOvertimeDate(e.target.value)}
                  className="w-full min-h-[44px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ot-start"
                    className="block text-xs font-semibold text-[#1A1E1A] mb-1.5"
                  >
                    Jam Mulai
                  </label>
                  <input
                    id="ot-start"
                    type="time"
                    required
                    value={otStartTime}
                    onChange={(e) => setOtStartTime(e.target.value)}
                    className="w-full min-h-[44px] rounded-2xl border border-[#7A8F7C] bg-white px-3 text-sm text-[#1A1E1A]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ot-end"
                    className="block text-xs font-semibold text-[#1A1E1A] mb-1.5"
                  >
                    Jam Selesai
                  </label>
                  <input
                    id="ot-end"
                    type="time"
                    required
                    value={otEndTime}
                    onChange={(e) => setOtEndTime(e.target.value)}
                    className="w-full min-h-[44px] rounded-2xl border border-[#7A8F7C] bg-white px-3 text-sm text-[#1A1E1A]"
                  />
                </div>
              </div>

              {/* Live Calculation Preview */}
              <div className="rounded-2xl bg-[#F3F8F3] border border-[#D4E4D5] p-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="block text-[#465147]">Durasi Terhitung</span>
                  <strong className="text-sm text-[#1A1E1A] tabular-nums">
                    {formatMinutesAsHours(liveOtDuration)} jam ({liveOtDuration} mnt)
                  </strong>
                </div>
                <div className="text-right">
                  <span className="block text-[#465147]">
                    Est. Uang Lembur
                  </span>
                  <strong className="text-sm text-[#1D5420] tabular-nums">
                    {formatRupiah(liveOtEstimate)}
                  </strong>
                </div>
              </div>

              <div>
                <label
                  htmlFor="ot-task"
                  className="block text-xs font-semibold text-[#1A1E1A] mb-1.5"
                >
                  Uraian Pekerjaan Lembur
                </label>
                <textarea
                  id="ot-task"
                  rows={3}
                  required
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Contoh: Penyelesaian laporan audit stok bulanan..."
                  className="w-full rounded-2xl border border-[#7A8F7C] bg-white px-3.5 py-2.5 text-sm text-[#1A1E1A]"
                />
              </div>

              <button
                type="submit"
                disabled={submittingOt}
                className="w-full min-h-[46px] rounded-full bg-[#246326] text-white text-sm font-bold hover:bg-[#1b4e1d] disabled:opacity-50"
              >
                {submittingOt ? "Mengirim..." : "Ajukan Lembur Sekarang"}
              </button>
            </form>

            {/* Right Table/Cards: Overtime List */}
            <div className="lg:col-span-8 rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base sm:text-lg font-bold text-[#1A1E1A]">
                  Daftar Pengajuan Lembur
                </h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setOtPage(1);
                    setOtQ(otSearchInput.trim());
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="search"
                    value={otSearchInput}
                    onChange={(e) => setOtSearchInput(e.target.value)}
                    placeholder="Cari nama/kode..."
                    aria-label="Cari pengajuan lembur"
                    className="min-h-[40px] w-full sm:w-44 rounded-full border border-[#7A8F7C] bg-white px-3.5 text-xs text-[#1A1E1A]"
                  />
                  <select
                    value={otStatusFilter}
                    onChange={(e) => {
                      setOtPage(1);
                      setOtStatusFilter(e.target.value);
                    }}
                    aria-label="Filter status lembur"
                    className="min-h-[40px] rounded-full border border-[#7A8F7C] bg-white px-3 text-xs text-[#1A1E1A]"
                  >
                    <option value="all">Semua Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Disetujui</option>
                    <option value="rejected">Ditolak</option>
                  </select>
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 rounded-full bg-[#1F211E] text-[#F6FAF6] text-xs font-semibold"
                  >
                    Cari
                  </button>
                </form>
              </div>

              {otLoading ? (
                <div className="space-y-2.5">
                  <div className="h-16 rounded-2xl bg-[#EEF5EE] animate-pulse" />
                  <div className="h-16 rounded-2xl bg-[#EEF5EE] animate-pulse" />
                </div>
              ) : otError ? (
                <div className="rounded-2xl bg-[#FEE2E2] p-5 text-center space-y-2">
                  <p className="text-sm font-semibold text-[#991B1B]">
                    {otError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadOvertimes()}
                    className="min-h-[40px] px-4 rounded-full bg-[#991B1B] text-white text-xs font-semibold"
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : !otData || otData.requests.length === 0 ? (
                <div className="rounded-2xl bg-[#F3F8F3] border border-dashed border-[#B7CEB8] p-6 text-center">
                  <CheckCircleIcon className="w-8 h-8 text-[#465147] mx-auto mb-2" />
                  <p className="text-sm font-semibold text-[#1A1E1A]">
                    Belum ada pengajuan lembur
                  </p>
                  <p className="text-xs text-[#465147] mt-1">
                    Isi formulir pengajuan lembur di sebelah kiri untuk mencatat jam lembur baru.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {otData.requests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-2xl bg-[#F6FAF6] border border-[#DCEADC] p-4 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-[#1A1E1A] tabular-nums">
                              {req.overtimeCode}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase ${
                                req.status === "approved"
                                  ? "bg-[#E6F4E7] text-[#1D5420]"
                                  : req.status === "rejected"
                                    ? "bg-[#FEE2E2] text-[#991B1B]"
                                    : "bg-[#FEF3C7] text-[#92400E]"
                              }`}
                            >
                              {req.status}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-[#1A1E1A] mt-1">
                            {req.fullName}{" "}
                            <span className="text-xs font-normal text-[#465147]">
                              ({req.employeeCode})
                            </span>
                          </p>
                        </div>

                        <div className="text-right tabular-nums">
                          <p className="text-xs font-semibold text-[#1A1E1A]">
                            {req.overtimeDate} | {req.startTime} - {req.endTime}
                          </p>
                          <p className="text-xs font-bold text-[#1D5420]">
                            {formatMinutesAsHours(req.durationMinutes)} jam |{" "}
                            {formatRupiah(req.estimatedPay)}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-[#1A1E1A]">
                        {req.taskDescription}
                      </p>

                      {req.reviewNote && (
                        <p className="text-xs rounded-xl bg-white border border-[#DCEADC] px-3 py-2 text-[#465147]">
                          <strong>Catatan Atasan:</strong> {req.reviewNote}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        {isAdmin && req.status === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setReviewAction({
                                  kind: "overtime",
                                  id: req.id,
                                  code: req.overtimeCode,
                                  fullName: req.fullName,
                                  summary: `Lembur ${req.overtimeDate} (${req.startTime}-${req.endTime}) | ${formatRupiah(req.estimatedPay)}`,
                                  decision: "approved",
                                })
                              }
                              className="min-h-[38px] px-4 rounded-full bg-[#246326] text-white text-xs font-semibold hover:bg-[#1b4e1d]"
                            >
                              Setujui
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setReviewAction({
                                  kind: "overtime",
                                  id: req.id,
                                  code: req.overtimeCode,
                                  fullName: req.fullName,
                                  summary: `Lembur ${req.overtimeDate} (${req.startTime}-${req.endTime}) | ${formatRupiah(req.estimatedPay)}`,
                                  decision: "rejected",
                                })
                              }
                              className="min-h-[38px] px-4 rounded-full bg-[#991B1B] text-white text-xs font-semibold hover:bg-[#7F1D1D]"
                            >
                              Tolak
                            </button>
                          </>
                        )}
                        {req.status === "pending" &&
                          (req.userId === initialUser.id || isAdmin) && (
                            <button
                              type="button"
                              onClick={() =>
                                setCancelTarget({
                                  kind: "overtime",
                                  id: req.id,
                                  code: req.overtimeCode,
                                })
                              }
                              className="min-h-[38px] px-3.5 rounded-full border border-[#7A8F7C] bg-white text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2]"
                            >
                              Batalkan
                            </button>
                          )}
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EEF5EE] text-xs text-[#465147]">
                    <span>
                      Halaman {otData.page} dari {otData.totalPages} ({otData.total} item)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={otData.page <= 1}
                        onClick={() => setOtPage((p) => Math.max(1, p - 1))}
                        className="min-h-[38px] px-3.5 rounded-full border border-[#7A8F7C] bg-white text-[#1A1E1A] font-semibold disabled:opacity-45"
                      >
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        disabled={otData.page >= otData.totalPages}
                        onClick={() =>
                          setOtPage((p) => Math.min(otData.totalPages, p + 1))
                        }
                        className="min-h-[38px] px-3.5 rounded-full border border-[#7A8F7C] bg-white text-[#1A1E1A] font-semibold disabled:opacity-45"
                      >
                        Berikutnya
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Attachment Preview Modal */}
      <Modal
        open={Boolean(previewLeave)}
        onClose={() => setPreviewLeave(null)}
        title={`Lampiran ${previewLeave?.requestCode ?? ""}`}
        maxWidthClass="max-w-2xl"
      >
        {previewLeave?.attachmentDataUrl && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#465147]">
                {previewLeave.attachmentName || "Lampiran Bukti"}
              </p>
              <a
                href={previewLeave.attachmentDataUrl}
                download={previewLeave.attachmentName || `${previewLeave.requestCode}-lampiran`}
                className="min-h-[38px] px-4 rounded-full bg-[#1F211E] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                <span>Unduh File</span>
              </a>
            </div>
            {previewLeave.attachmentMime?.includes("pdf") ||
            previewLeave.attachmentDataUrl.startsWith("data:application/pdf") ? (
              <iframe
                src={previewLeave.attachmentDataUrl}
                title={`Dokumen lampiran ${previewLeave.requestCode}`}
                className="w-full h-[460px] rounded-2xl border border-[#DCEADC]"
              />
            ) : (
              <img
                src={previewLeave.attachmentDataUrl}
                alt={`Lampiran ${previewLeave.requestCode}`}
                width={800}
                height={600}
                className="w-full max-h-[500px] object-contain rounded-2xl border border-[#DCEADC] bg-[#F5FAF5]"
              />
            )}
          </div>
        )}
      </Modal>

      {/* Admin Approval Modal */}
      <Modal
        open={Boolean(reviewAction)}
        onClose={() => {
          if (!submittingReview) {
            setReviewAction(null);
            setReviewNote("");
          }
        }}
        title={
          reviewAction?.decision === "approved"
            ? `Setujui ${reviewAction.code}`
            : `Tolak ${reviewAction?.code ?? ""}`
        }
      >
        {reviewAction && (
          <form onSubmit={handleConfirmReview} className="space-y-4">
            <div className="rounded-2xl bg-[#F3F8F3] border border-[#DCEADC] p-3.5 text-sm">
              <p className="font-bold text-[#1A1E1A]">
                {reviewAction.fullName}
              </p>
              <p className="text-xs text-[#465147] mt-0.5">
                {reviewAction.summary}
              </p>
            </div>
            <div>
              <label
                htmlFor="pengajuan-review-note"
                className="block text-xs font-semibold text-[#1A1E1A] mb-1.5"
              >
                Catatan Atasan (opsional)
              </label>
              <textarea
                id="pengajuan-review-note"
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Tambahkan catatan persetujuan..."
                className="w-full rounded-2xl border border-[#7A8F7C] bg-white px-3.5 py-2.5 text-sm text-[#1A1E1A]"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submittingReview}
                onClick={() => {
                  setReviewAction(null);
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
                  reviewAction.decision === "approved"
                    ? "bg-[#246326] hover:bg-[#1b4e1d]"
                    : "bg-[#991B1B] hover:bg-[#7F1D1D]"
                }`}
              >
                {submittingReview
                  ? "Menyimpan..."
                  : reviewAction.decision === "approved"
                    ? "Konfirmasi Setujui"
                    : "Konfirmasi Tolak"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Cancel Pending Confirmation Modal */}
      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => {
          if (!cancelling) setCancelTarget(null);
        }}
        title={`Batalkan ${cancelTarget?.code ?? ""}`}
      >
        {cancelTarget && (
          <div className="space-y-4">
            <p className="text-sm text-[#465147]">
              Yakin ingin membatalkan pengajuan <strong>{cancelTarget.code}</strong>? Tindakan ini tidak dapat dikembalikan.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setCancelTarget(null)}
                className="min-h-[44px] px-4 rounded-full border border-[#7A8F7C] text-sm font-semibold text-[#1A1E1A]"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => void handleConfirmCancel()}
                className="min-h-[44px] px-5 rounded-full bg-[#991B1B] text-white text-sm font-semibold hover:bg-[#7F1D1D] disabled:opacity-50"
              >
                {cancelling ? "Membatalkan..." : "Ya, Batalkan"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
