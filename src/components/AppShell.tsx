"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SafeUser } from "@/lib/auth";
import { useDataCache } from "./DataCacheContext";
import { useToast } from "./ToastContext";
import { Modal } from "./Modal";
import {
  BrandMark,
  CameraIcon,
  ClipboardCheckIcon,
  DashboardIcon,
  FileSpreadsheetIcon,
  LogOutIcon,
  MenuGridIcon,
  RefreshIcon,
  SlidersIcon,
  UsersIcon,
} from "./Icons";

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

interface AppShellProps {
  user: SafeUser;
  companyName?: string;
  pendingCount?: number;
  onRefresh?: () => void;
  children: React.ReactNode;
}

export function AppShell({
  user,
  companyName = "TalentaZ 2.0",
  pendingCount = 0,
  onRefresh,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { clearAllCache } = useDataCache();
  const { showToast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      {
        href: "/dashboard",
        label: "Dashboard",
        shortLabel: "Home",
        icon: <DashboardIcon className="w-4 h-4" />,
      },
      {
        href: "/absen",
        label: "Absen Selfie",
        shortLabel: "Absen",
        icon: <CameraIcon className="w-4 h-4" />,
      },
      {
        href: "/pengajuan",
        label: user.role === "admin" ? "Izin & Lembur" : "Pengajuan",
        shortLabel: "Izin/Lembur",
        icon: <ClipboardCheckIcon className="w-4 h-4" />,
      },
      {
        href: "/rekap",
        label: "Rekap & Ekspor",
        shortLabel: "Rekap",
        icon: <FileSpreadsheetIcon className="w-4 h-4" />,
      },
    ];

    if (user.role === "admin") {
      items.push(
        {
          href: "/karyawan",
          label: "Karyawan",
          shortLabel: "Karyawan",
          icon: <UsersIcon className="w-4 h-4" />,
          adminOnly: true,
        },
        {
          href: "/pengaturan",
          label: "Pengaturan",
          shortLabel: "Setting",
          icon: <SlidersIcon className="w-4 h-4" />,
          adminOnly: true,
        }
      );
    }
    return items;
  }, [user.role]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      clearAllCache();
      router.push("/login");
      router.refresh();
    } catch {
      showToast("Gagal keluar dari sesi.", "error");
    } finally {
      setLoggingOut(false);
    }
  }

  function handleForceRefresh() {
    clearAllCache();
    if (onRefresh) {
      onRefresh();
    } else {
      router.refresh();
    }
    showToast("Data terbaru disinkronkan dari database.", "info");
  }

  const primaryMobileItems = navItems.slice(0, 4);
  const extraItems = navItems.slice(4);
  const initials = user.fullName
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="min-h-dvh sage-workspace-bg p-0 md:p-4 lg:p-6">
      <div className="mx-auto max-w-[1380px] min-h-dvh md:min-h-[calc(100dvh-2rem)] lg:min-h-[calc(100dvh-3rem)] sage-shell-surface md:rounded-[28px] border-0 md:border md:border-[#D4E4D5] shadow-none md:shadow-[0_18px_50px_-24px_rgba(31,33,30,0.18)] flex flex-col">
        {/* Desktop & Tablet floating translucent header matching reference design */}
        <header className="sticky top-0 z-30 bg-white/75 backdrop-blur-md border-b border-[#D4E4D5] md:rounded-t-[28px] px-4 md:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full border border-[#D4E4D5] bg-white text-[#1A1E1A] font-semibold text-sm tracking-tight hover:border-[#246326] transition-colors shrink-0"
            >
              <BrandMark className="w-5 h-5 text-[#1F211E]" />
              <span>{companyName === "TalentaZ 2.0" ? "TalentaZ 2.0" : "TalentaZ 2.0"}</span>
            </Link>

            {/* Desktop horizontal pill navigation */}
            <nav
              aria-label="Navigasi utama"
              className="hidden lg:flex items-center gap-1.5 bg-[#EFF6EF] border border-[#D4E4D5] rounded-full p-1"
            >
              {navItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? "bg-[#1F211E] text-[#F6FAF6]"
                        : "text-[#1A1E1A] hover:bg-white"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {item.href === "/pengajuan" && pendingCount > 0 && (
                      <span
                        className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                          active
                            ? "bg-[#347F2F] text-white"
                            : "bg-[#246326] text-white"
                        }`}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleForceRefresh}
                aria-label="Segarkan data dari server"
                title="Segarkan Data"
                className="min-w-[44px] min-h-[44px] px-3 rounded-full border border-[#D4E4D5] bg-white text-[#1A1E1A] hover:bg-[#F3F8F3] inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
              >
                <RefreshIcon className="w-4 h-4" />
                <span className="hidden xl:inline">Segarkan</span>
              </button>

              {user.role === "admin" && (
                <Link
                  href="/pengaturan"
                  className="hidden md:inline-flex lg:hidden items-center gap-1.5 min-h-[44px] px-3.5 rounded-full border border-[#D4E4D5] bg-white text-[#1A1E1A] text-xs font-medium hover:bg-[#F3F8F3]"
                >
                  <SlidersIcon className="w-4 h-4" />
                  <span>Setting</span>
                </Link>
              )}

              <div className="hidden sm:flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border border-[#D4E4D5] bg-white">
                <div className="w-8 h-8 rounded-full bg-[#1F211E] text-[#F6FAF6] flex items-center justify-center text-xs font-semibold">
                  {initials || "TZ"}
                </div>
                <div className="pr-2 leading-tight hidden md:block">
                  <div className="text-xs font-semibold text-[#1A1E1A] max-w-[120px] truncate">
                    {user.fullName}
                  </div>
                  <div className="text-[11px] text-[#465147] uppercase tracking-wide">
                    {user.role === "admin" ? "Admin / Atasan" : "Karyawan"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  aria-label="Keluar dari aplikasi"
                  title="Keluar"
                  className="min-w-[36px] min-h-[36px] rounded-full hover:bg-[#FEE2E2] hover:text-[#991B1B] text-[#465147] flex items-center justify-center transition-colors"
                >
                  <LogOutIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Tablet overflow trigger */}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Buka menu navigasi lainnya"
                className="hidden md:inline-flex lg:hidden min-w-[44px] min-h-[44px] px-3 rounded-full border border-[#D4E4D5] bg-white text-[#1A1E1A] items-center gap-1.5 text-sm font-medium hover:bg-[#F3F8F3]"
              >
                <MenuGridIcon className="w-4 h-4" />
                <span>Menu</span>
              </button>
            </div>
          </div>

          {/* Tablet secondary compact nav row so intermediate widths never crowd */}
          <nav
            aria-label="Navigasi tablet"
            className="hidden md:flex lg:hidden items-center gap-1.5 mt-2.5 overflow-x-auto pb-1"
          >
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-[#1F211E] text-[#F6FAF6]"
                      : "bg-white border border-[#D4E4D5] text-[#1A1E1A]"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </header>

        {/* Main content area with bottom padding on mobile so fixed bottom nav never covers content */}
        <main className="flex-1 px-4 md:px-6 pt-4 md:pt-6 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile fixed bottom navigation bar */}
      <nav
        aria-label="Navigasi ponsel"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#D4E4D5] px-2 pt-1.5 pb-[calc(0.45rem+env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(31,33,30,0.08)]"
      >
        <div className="grid grid-cols-5 gap-1">
          {primaryMobileItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors relative ${
                  active
                    ? "bg-[#1F211E] text-[#F6FAF6]"
                    : "text-[#465147] hover:bg-[#F3F8F3] hover:text-[#1A1E1A]"
                }`}
              >
                {item.icon}
                <span className="truncate max-w-full">{item.shortLabel}</span>
                {item.href === "/pengajuan" && pendingCount > 0 && (
                  <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#246326] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menu lainnya dan akun"
            className="min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-[#465147] hover:bg-[#F3F8F3] hover:text-[#1A1E1A]"
          >
            <MenuGridIcon className="w-4 h-4" />
            <span>Lainnya</span>
          </button>
        </div>
      </nav>

      {/* Overflow menu drawer / modal for Mobile & Tablet */}
      <Modal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Menu & Akun"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F3F8F3] border border-[#D4E4D5]">
            <div className="w-11 h-11 rounded-full bg-[#1F211E] text-[#F6FAF6] flex items-center justify-center text-sm font-semibold shrink-0">
              {initials || "TZ"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[#1A1E1A] truncate">
                {user.fullName}
              </div>
              <div className="text-xs text-[#465147]">
                {user.employeeCode} · {user.position}
              </div>
              <div className="text-[11px] font-semibold text-[#246326] mt-0.5">
                {user.role === "admin" ? "Admin / Atasan" : "Karyawan"}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {extraItems.length > 0 && (
              <div className="text-xs font-semibold text-[#465147] uppercase tracking-wide px-1">
                Menu Administrasi
              </div>
            )}
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`min-h-[46px] px-4 rounded-xl flex items-center justify-between text-sm font-medium border transition-colors ${
                    active
                      ? "bg-[#1F211E] text-[#F6FAF6] border-[#1F211E]"
                      : "bg-white text-[#1A1E1A] border-[#D4E4D5] hover:bg-[#F3F8F3]"
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.href === "/pengajuan" && pendingCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#246326] text-white text-xs font-semibold tabular-nums">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#D4E4D5] grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                handleForceRefresh();
              }}
              className="min-h-[44px] rounded-xl border border-[#7A8F7C] bg-white text-[#1A1E1A] text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[#F3F8F3]"
            >
              <RefreshIcon className="w-4 h-4" />
              <span>Segarkan</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="min-h-[44px] rounded-xl bg-[#991B1B] text-white text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[#7F1D1D]"
            >
              <LogOutIcon className="w-4 h-4" />
              <span>{loggingOut ? "Keluar..." : "Keluar"}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
