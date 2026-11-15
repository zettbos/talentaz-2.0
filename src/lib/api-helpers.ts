import { NextResponse } from "next/server";
import { getCurrentUser, type SafeUser } from "@/lib/auth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAuth(): Promise<
  { user: SafeUser; error?: never } | { user?: never; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: jsonError("Sesi berakhir. Silakan login kembali.", 401) };
  }
  return { user };
}

export async function requireAdminAuth(): Promise<
  { user: SafeUser; error?: never } | { user?: never; error: NextResponse }
> {
  const auth = await requireAuth();
  if (auth.error) return auth;
  if (auth.user.role !== "admin") {
    return { error: jsonError("Akses ditolak. Khusus Admin.", 403) };
  }
  return { user: auth.user };
}

export function sanitizeString(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function parsePositiveInt(value: string | null, fallback: number, max = 100): number {
  if (!value) return fallback;
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num) || num < 1) return fallback;
  return Math.min(num, max);
}
