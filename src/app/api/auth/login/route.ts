import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companySettings, users } from "@/db/schema";
import { ensureInitialized } from "@/db/seed";
import { jsonError, sanitizeString } from "@/lib/api-helpers";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  stripPasswordHash,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await ensureInitialized();
    const body = await request.json();
    const username = sanitizeString(body.username, 60).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return jsonError("ID / Username dan password wajib diisi.", 400);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      return jsonError("Username atau password tidak sesuai.", 401);
    }
    if (!user.isActive) {
      return jsonError("Akun Anda sedang dinonaktifkan oleh Admin.", 403);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return jsonError("Username atau password tidak sesuai.", 401);
    }

    const token = createSessionToken(user.id, user.role);
    const [settings] = await db.select().from(companySettings).limit(1);

    const response = NextResponse.json({
      user: stripPasswordHash(user),
      companyName: settings?.companyName ?? "TalentaZ 2.0",
    });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return jsonError("Gagal memproses login. Periksa koneksi database.", 500);
  }
}
