import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/absen",
  "/pengajuan",
  "/rekap",
  "/karyawan",
  "/pengaturan",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(hasSessionCookie ? "/dashboard" : "/login", request.url)
    );
  }

  if (pathname === "/login" && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (isProtected && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/absen/:path*",
    "/pengajuan/:path*",
    "/rekap/:path*",
    "/karyawan/:path*",
    "/pengaturan/:path*",
  ],
};
