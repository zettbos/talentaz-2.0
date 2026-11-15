"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SafeUser } from "@/lib/auth";
import { compressLogoOrAvatar } from "@/lib/media-client";
import { formatRupiah } from "@/lib/time";
import { useCachedQuery } from "@/lib/use-cached-query";
import { useProtectedShell, useSyncShellMeta } from "./ProtectedShellContext";
import { useDataCache } from "./DataCacheContext";
import { useToast } from "./ToastContext";
import { Modal } from "./Modal";
import {
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  UploadIcon,
  UsersIcon,
} from "./Icons";

interface UsersListPayload {
  users: SafeUser[];
  total: number;
  page: number;
  totalPages: number;
  nextEmployeeCode: string;
}

export function KaryawanClient({
  initialUser: initialUserProp,
}: {
  initialUser?: SafeUser;
}) {
  const router = useRouter();
  const { user: shellUser } = useProtectedShell();
  const initialUser = initialUserProp ?? shellUser;
  const { invalidatePrefix } = useDataCache();
  const { showToast } = useToast();

  useEffect(() => {
    if (initialUser.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [initialUser.role, router]);

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);

  const usersUrl = useMemo(() => {
    const params = new URLSearchParams({
      q,
      role: roleFilter,
      active: activeFilter,
      page: String(page),
      limit: "12",
    });
    return `/api/users?${params.toString()}`;
  }, [activeFilter, page, q, roleFilter]);

  const cacheKey = useMemo(
    () => `users:q=${q}&r=${roleFilter}&a=${activeFilter}&p=${page}`,
    [activeFilter, page, q, roleFilter]
  );

  const {
    data: payload,
    loading,
    errorMsg,
    refetch: loadUsers,
  } = useCachedQuery<UsersListPayload>(
    cacheKey,
    usersUrl,
    "Gagal memuat data karyawan."
  );

  // Add User Modal state.
  const [addOpen, setAddOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPosition, setNewPosition] = useState("Staf Operasional");
  const [newRole, setNewRole] = useState<"employee" | "admin">("employee");
  const [newBaseSalary, setNewBaseSalary] = useState("4500000");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit User Modal state.
  const [editTarget, setEditTarget] = useState<SafeUser | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editRole, setEditRole] = useState<"employee" | "admin">("employee");
  const [editSalary, setEditSalary] = useState("0");
  const [editActive, setEditActive] = useState(true);
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Reset Password Modal state.
  const [resetTarget, setResetTarget] = useState<SafeUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [savingReset, setSavingReset] = useState(false);

  function openEditModal(u: SafeUser) {
    setEditTarget(u);
    setEditFullName(u.fullName);
    setEditPosition(u.position);
    setEditRole(u.role === "admin" ? "admin" : "employee");
    setEditSalary(String(u.baseSalary));
    setEditActive(u.isActive);
    setEditAvatar(u.avatarDataUrl);
  }

  async function handleAvatarUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressLogoOrAvatar(file, 260, false);
      setter(compressed);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal memproses foto profil.",
        "error"
      );
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim().toLowerCase(),
          fullName: newFullName.trim(),
          position: newPosition.trim(),
          role: newRole,
          baseSalary: Number(newBaseSalary) || 0,
          password: newPassword,
          avatarDataUrl: newAvatar,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menambah karyawan.");
      }

      showToast(
        `Akun ${json.user?.employeeCode ?? ""} (${json.user?.username ?? ""}) berhasil dibuat.`,
        "success"
      );
      setAddOpen(false);
      setNewUsername("");
      setNewFullName("");
      setNewPosition("Staf Operasional");
      setNewRole("employee");
      setNewBaseSalary("4500000");
      setNewPassword("");
      setNewAvatar(null);
      setPage(1);
      invalidatePrefix("users");
      invalidatePrefix("dashboard");
      invalidatePrefix("reports");
      await loadUsers();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal menambah karyawan.",
        "error"
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/users/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editFullName.trim(),
          position: editPosition.trim(),
          role: editRole,
          baseSalary: Number(editSalary) || 0,
          isActive: editActive,
          avatarDataUrl: editAvatar,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal memperbarui karyawan.");
      }

      showToast(`Profil ${editFullName} berhasil diperbarui.`, "success");
      setEditTarget(null);
      invalidatePrefix("users");
      invalidatePrefix("dashboard");
      invalidatePrefix("reports");
      await loadUsers();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal menyimpan perubahan.",
        "error"
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleSaveResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    if (resetPassword.length < 5) {
      showToast("Password baru minimal 5 karakter.", "error");
      return;
    }
    setSavingReset(true);
    try {
      const res = await fetch(`/api/users/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: resetPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal mereset password.");
      }

      showToast(
        `Password untuk ${resetTarget.fullName} berhasil diperbarui.`,
        "success"
      );
      setResetTarget(null);
      setResetPassword("");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal mereset password.",
        "error"
      );
    } finally {
      setSavingReset(false);
    }
  }

  useSyncShellMeta({
    onRefresh: () => {
      invalidatePrefix("users");
      void loadUsers();
    },
  });

  if (initialUser.role !== "admin") {
    return null;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Title & Add Button */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1E1A]">
              Manajemen Karyawan & Akun Login
            </h1>
            <p className="text-xs sm:text-sm text-[#465147] mt-0.5">
              Tambah user baru, atur ID/password login database, jabatan, gaji pokok, dan peran atasan/karyawan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="min-h-[46px] px-5 rounded-full bg-[#246326] text-white text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-[#1b4e1d] self-start sm:self-auto"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Tambah Karyawan</span>
          </button>
        </section>

        {/* Filters & Table Card */}
        <section className="rounded-[28px] bg-white/95 border border-white/80 shadow-sm p-5 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQ(searchInput.trim());
            }}
            className="flex flex-wrap items-center gap-2.5"
          >
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nama, username, kode EMP..."
              aria-label="Cari karyawan"
              className="min-h-[42px] flex-1 min-w-[180px] rounded-full border border-[#7A8F7C] bg-white px-4 text-xs sm:text-sm text-[#1A1E1A]"
            />
            <select
              value={roleFilter}
              onChange={(e) => {
                setPage(1);
                setRoleFilter(e.target.value);
              }}
              aria-label="Filter peran"
              className="min-h-[42px] rounded-full border border-[#7A8F7C] bg-white px-3.5 text-xs sm:text-sm text-[#1A1E1A]"
            >
              <option value="">Semua Peran</option>
              <option value="admin">Admin / Atasan</option>
              <option value="employee">Karyawan</option>
            </select>
            <select
              value={activeFilter}
              onChange={(e) => {
                setPage(1);
                setActiveFilter(e.target.value);
              }}
              aria-label="Filter status aktif"
              className="min-h-[42px] rounded-full border border-[#7A8F7C] bg-white px-3.5 text-xs sm:text-sm text-[#1A1E1A]"
            >
              <option value="">Semua Status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
            <button
              type="submit"
              className="min-h-[42px] px-5 rounded-full bg-[#1F211E] text-[#F6FAF6] text-xs sm:text-sm font-semibold"
            >
              Cari
            </button>
          </form>

          {loading ? (
            <div className="space-y-2.5">
              <div className="h-14 rounded-2xl bg-[#EEF5EE] animate-pulse" />
              <div className="h-14 rounded-2xl bg-[#EEF5EE] animate-pulse" />
            </div>
          ) : errorMsg ? (
            <div className="rounded-2xl bg-[#FEE2E2] p-5 text-center space-y-2">
              <p className="text-sm font-semibold text-[#991B1B]">{errorMsg}</p>
              <button
                type="button"
                onClick={() => void loadUsers()}
                className="min-h-[40px] px-4 rounded-full bg-[#991B1B] text-white text-xs font-semibold"
              >
                Coba Lagi
              </button>
            </div>
          ) : !payload || payload.users.length === 0 ? (
            <div className="rounded-2xl bg-[#F3F8F3] border border-dashed border-[#B7CEB8] p-6 text-center">
              <UsersIcon className="w-8 h-8 text-[#465147] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#1A1E1A]">
                Tidak ada karyawan sesuai filter
              </p>
              <p className="text-xs text-[#465147] mt-1">
                Klik tombol Tambah Karyawan di atas untuk membuat akun baru.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {payload.users.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-2xl bg-[#F6FAF6] border border-[#DCEADC] p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {u.avatarDataUrl ? (
                          <img
                            src={u.avatarDataUrl}
                            alt={u.fullName}
                            width={44}
                            height={44}
                            className="w-11 h-11 rounded-full object-cover border border-[#DCEADC] shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-[#1F211E] text-[#F6FAF6] flex items-center justify-center text-xs font-bold shrink-0">
                            {u.fullName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#1A1E1A] truncate">
                            {u.fullName}
                          </p>
                          <p className="text-xs text-[#465147] truncate">
                            {u.employeeCode} | @{u.username}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          u.isActive
                            ? "bg-[#E6F4E7] text-[#1D5420]"
                            : "bg-[#FEE2E2] text-[#991B1B]"
                        }`}
                      >
                        {u.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#465147] tabular-nums">
                      <span>{u.position} ({u.role})</span>
                      <strong className="text-[#1A1E1A]">
                        {formatRupiah(u.baseSalary)}
                      </strong>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(u)}
                        className="min-h-[40px] rounded-full border border-[#7A8F7C] bg-white text-xs font-semibold text-[#1A1E1A]"
                      >
                        Edit Profil
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetTarget(u);
                          setResetPassword("");
                        }}
                        className="min-h-[40px] rounded-full bg-[#1F211E] text-[#F6FAF6] text-xs font-semibold"
                      >
                        Reset Password
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#DCEADC] text-[11px] font-bold uppercase tracking-wider text-[#465147]">
                      <th className="py-3 px-3">Kode & Karyawan</th>
                      <th className="py-3 px-3">ID Login</th>
                      <th className="py-3 px-3">Jabatan & Peran</th>
                      <th className="py-3 px-3 text-right">Gaji Pokok</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF5EE] text-sm">
                    {payload.users.map((u) => (
                      <tr key={u.id} className="hover:bg-[#F5FAF5]">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            {u.avatarDataUrl ? (
                              <img
                                src={u.avatarDataUrl}
                                alt={u.fullName}
                                width={38}
                                height={38}
                                className="w-9 h-9 rounded-full object-cover border border-[#DCEADC] shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-[#1F211E] text-[#F6FAF6] flex items-center justify-center text-xs font-bold shrink-0">
                                {u.fullName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-[#1A1E1A]">
                                {u.fullName}
                              </div>
                              <div className="text-xs text-[#465147] tabular-nums">
                                {u.employeeCode}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs font-semibold text-[#1A1E1A]">
                          @{u.username}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <div className="font-semibold text-[#1A1E1A]">
                            {u.position}
                          </div>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-[#F3F8F3] border border-[#DCEADC] text-[10px] font-semibold uppercase text-[#465147]">
                            {u.role === "admin" ? "Admin / Atasan" : "Karyawan"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold tabular-nums text-xs">
                          {formatRupiah(u.baseSalary)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              u.isActive
                                ? "bg-[#E6F4E7] text-[#1D5420]"
                                : "bg-[#FEE2E2] text-[#991B1B]"
                            }`}
                          >
                            {u.isActive ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              className="min-h-[36px] px-3 rounded-full border border-[#7A8F7C] bg-white text-xs font-semibold text-[#1A1E1A] hover:bg-[#E6F4E7]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResetTarget(u);
                                setResetPassword("");
                              }}
                              className="min-h-[36px] px-3 rounded-full bg-[#1F211E] text-[#F6FAF6] text-xs font-semibold hover:bg-black"
                            >
                              Reset Password
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EEF5EE] text-xs text-[#465147]">
                <span>
                  Halaman {payload.page} dari {payload.totalPages} ({payload.total} akun)
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

      {/* Add User Modal */}
      <Modal
        open={addOpen}
        onClose={() => {
          if (!creating) setAddOpen(false);
        }}
        title="Tambah Akun Karyawan Baru"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="rounded-2xl bg-[#F3F8F3] border border-[#DCEADC] px-4 py-2.5 flex items-center justify-between text-xs">
            <span className="text-[#465147]">Kode Karyawan Otomatis</span>
            <strong className="text-[#1D5420] tabular-nums">
              {payload?.nextEmployeeCode ?? "EMP-..."}
            </strong>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="new-username"
                className="block text-xs font-semibold text-[#1A1E1A] mb-1"
              >
                ID Login / Username
              </label>
              <input
                id="new-username"
                type="text"
                required
                minLength={3}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="misal: budi.santoso"
                className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A]"
              />
            </div>

            <div>
              <label
                htmlFor="new-fullname"
                className="block text-xs font-semibold text-[#1A1E1A] mb-1"
              >
                Nama Lengkap
              </label>
              <input
                id="new-fullname"
                type="text"
                required
                minLength={2}
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Budi Santoso"
                className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A]"
              />
            </div>

            <div>
              <label
                htmlFor="new-position"
                className="block text-xs font-semibold text-[#1A1E1A] mb-1"
              >
                Jabatan / Divisi
              </label>
              <input
                id="new-position"
                type="text"
                required
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
                className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A]"
              />
            </div>

            <div>
              <label
                htmlFor="new-role"
                className="block text-xs font-semibold text-[#1A1E1A] mb-1"
              >
                Peran Akses
              </label>
              <select
                id="new-role"
                value={newRole}
                onChange={(e) =>
                  setNewRole(e.target.value as "employee" | "admin")
                }
                className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A]"
              >
                <option value="employee">Karyawan</option>
                <option value="admin">Admin / Atasan</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="new-salary"
                className="block text-xs font-semibold text-[#1A1E1A] mb-1"
              >
                Gaji Pokok (Rp / bulan)
              </label>
              <input
                id="new-salary"
                type="number"
                min={0}
                required
                value={newBaseSalary}
                onChange={(e) => setNewBaseSalary(e.target.value)}
                className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A] tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold text-[#1A1E1A] mb-1"
              >
                Password Login (min. 5 karakter)
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  required
                  minLength={5}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white pl-3.5 pr-11 text-sm text-[#1A1E1A]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={
                    showNewPassword ? "Sembunyikan password" : "Lihat password"
                  }
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-[#465147]"
                >
                  {showNewPassword ? (
                    <EyeOffIcon className="w-4 h-4" />
                  ) : (
                    <EyeIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F5FAF5] border border-[#DCEADC] p-3">
            <div className="flex items-center gap-3">
              {newAvatar ? (
                <img
                  src={newAvatar}
                  alt="Pratinjau foto profil"
                  width={44}
                  height={44}
                  className="w-11 h-11 rounded-full object-cover border border-[#DCEADC]"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-[#DCEADC] text-[#1A1E1A] flex items-center justify-center text-xs font-bold">
                  FOTO
                </div>
              )}
              <span className="text-xs text-[#465147]">
                Foto profil opsional
              </span>
            </div>
            <label
              htmlFor="new-avatar-input"
              className="min-h-[38px] px-3.5 rounded-full bg-white border border-[#7A8F7C] text-xs font-semibold text-[#1A1E1A] inline-flex items-center gap-1.5"
            >
              <UploadIcon className="w-3.5 h-3.5" />
              <span>Unggah</span>
            </label>
            <input
              id="new-avatar-input"
              type="file"
              accept="image/*"
              onChange={(e) => void handleAvatarUpload(e, setNewAvatar)}
              className="sr-only"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={creating}
              onClick={() => setAddOpen(false)}
              className="min-h-[44px] px-4 rounded-full border border-[#7A8F7C] text-sm font-semibold text-[#1A1E1A]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={creating}
              className="min-h-[44px] px-5 rounded-full bg-[#246326] text-white text-sm font-bold hover:bg-[#1b4e1d] disabled:opacity-50"
            >
              {creating ? "Menyimpan..." : "Simpan Akun"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={Boolean(editTarget)}
        onClose={() => {
          if (!savingEdit) setEditTarget(null);
        }}
        title={`Edit Karyawan ${editTarget?.employeeCode ?? ""}`}
      >
        {editTarget && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label
                htmlFor="edit-fullname"
                className="block text-xs font-semibold text-[#1A1E1A] mb-1"
              >
                Nama Lengkap
              </label>
              <input
                id="edit-fullname"
                type="text"
                required
                minLength={2}
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="edit-position"
                  className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                >
                  Jabatan
                </label>
                <input
                  id="edit-position"
                  type="text"
                  required
                  value={editPosition}
                  onChange={(e) => setEditPosition(e.target.value)}
                  className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A]"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-role"
                  className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                >
                  Peran Akses
                </label>
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) =>
                    setEditRole(e.target.value as "employee" | "admin")
                  }
                  disabled={editTarget.id === initialUser.id}
                  className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A] disabled:opacity-60"
                >
                  <option value="employee">Karyawan</option>
                  <option value="admin">Admin / Atasan</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label
                  htmlFor="edit-salary"
                  className="block text-xs font-semibold text-[#1A1E1A] mb-1"
                >
                  Gaji Pokok (Rp / bulan)
                </label>
                <input
                  id="edit-salary"
                  type="number"
                  min={0}
                  required
                  value={editSalary}
                  onChange={(e) => setEditSalary(e.target.value)}
                  className="w-full min-h-[42px] rounded-2xl border border-[#7A8F7C] bg-white px-3.5 text-sm text-[#1A1E1A] tabular-nums"
                />
              </div>

              <label className="flex items-center gap-2.5 min-h-[42px] px-3.5 rounded-2xl bg-[#F3F8F3] border border-[#DCEADC] text-xs font-semibold text-[#1A1E1A]">
                <input
                  type="checkbox"
                  checked={editActive}
                  disabled={editTarget.id === initialUser.id}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="w-4 h-4 accent-[#246326]"
                />
                <span>Akun Aktif Bisa Login</span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F5FAF5] border border-[#DCEADC] p-3">
              <div className="flex items-center gap-3">
                {editAvatar ? (
                  <img
                    src={editAvatar}
                    alt={`Foto ${editFullName}`}
                    width={44}
                    height={44}
                    className="w-11 h-11 rounded-full object-cover border border-[#DCEADC]"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-[#DCEADC] text-[#1A1E1A] flex items-center justify-center text-xs font-bold">
                    FOTO
                  </div>
                )}
                <span className="text-xs text-[#465147]">Foto profil</span>
              </div>
              <div className="flex items-center gap-2">
                {editAvatar && (
                  <button
                    type="button"
                    onClick={() => setEditAvatar(null)}
                    className="min-h-[36px] px-3 rounded-full bg-[#FEE2E2] text-[#991B1B] text-xs font-semibold"
                  >
                    Hapus
                  </button>
                )}
                <label
                  htmlFor="edit-avatar-input"
                  className="min-h-[36px] px-3.5 rounded-full bg-white border border-[#7A8F7C] text-xs font-semibold text-[#1A1E1A] inline-flex items-center gap-1"
                >
                  <UploadIcon className="w-3.5 h-3.5" />
                  <span>Ganti</span>
                </label>
                <input
                  id="edit-avatar-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleAvatarUpload(e, setEditAvatar)}
                  className="sr-only"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditTarget(null)}
                className="min-h-[44px] px-4 rounded-full border border-[#7A8F7C] text-sm font-semibold text-[#1A1E1A]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="min-h-[44px] px-5 rounded-full bg-[#246326] text-white text-sm font-bold hover:bg-[#1b4e1d] disabled:opacity-50"
              >
                {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={Boolean(resetTarget)}
        onClose={() => {
          if (!savingReset) setResetTarget(null);
        }}
        title={`Reset Password ${resetTarget?.fullName ?? ""}`}
      >
        {resetTarget && (
          <form onSubmit={handleSaveResetPassword} className="space-y-4">
            <p className="text-xs text-[#465147]">
              Masukkan password baru untuk akun{" "}
              <strong className="text-[#1A1E1A]">@{resetTarget.username}</strong>{" "}
              ({resetTarget.employeeCode}).
            </p>
            <div>
              <label
                htmlFor="reset-password-input"
                className="block text-xs font-semibold text-[#1A1E1A] mb-1"
              >
                Password Baru (minimal 5 karakter)
              </label>
              <div className="relative">
                <input
                  id="reset-password-input"
                  type={showResetPassword ? "text" : "password"}
                  required
                  minLength={5}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full min-h-[44px] rounded-2xl border border-[#7A8F7C] bg-white pl-3.5 pr-11 text-sm text-[#1A1E1A]"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword((v) => !v)}
                  aria-label={
                    showResetPassword ? "Sembunyikan password" : "Lihat password"
                  }
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-[#465147]"
                >
                  {showResetPassword ? (
                    <EyeOffIcon className="w-4 h-4" />
                  ) : (
                    <EyeIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={savingReset}
                onClick={() => setResetTarget(null)}
                className="min-h-[44px] px-4 rounded-full border border-[#7A8F7C] text-sm font-semibold text-[#1A1E1A]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingReset}
                className="min-h-[44px] px-5 rounded-full bg-[#1F211E] text-[#F6FAF6] text-sm font-bold hover:bg-black disabled:opacity-50"
              >
                {savingReset ? "Menyimpan..." : "Simpan Password Baru"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
