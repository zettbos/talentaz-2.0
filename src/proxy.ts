import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/absen",
  "/pengajuan",
  "/rekap",
  "/karyawan",
  "/pengaturan",
];

const ADMIN_PREFIXES = ["/karyawan", "/pengaturan"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(rawToken);

  if (pathname === "/") {
    const target = session ? "/dashboard" : "/login";
    const response = NextResponse.redirect(new URL(target, request.url));
    if (rawToken && !session) {
      response.cookies.delete(SESSION_COOKIE_NAME);
    }
    return response;
  }

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (rawToken) {
      const response = NextResponse.next();
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }
    return NextResponse.next();
  }

  if (matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    if (!session) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      if (rawToken) {
        response.cookies.delete(SESSION_COOKIE_NAME);
      }
      return response;
    }

    if (matchesPrefix(pathname, ADMIN_PREFIXES) && session.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
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
