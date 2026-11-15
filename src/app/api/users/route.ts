import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  jsonError,
  parsePositiveInt,
  requireAdminAuth,
  sanitizeString,
} from "@/lib/api-helpers";
import { hashPassword, stripPasswordHash } from "@/lib/auth";
import { generateNextCode, withUniqueCodeRetry } from "@/lib/codes";
import { getWibParts } from "@/lib/time";

export async function GET(request: Request) {
  const auth = await requireAdminAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = sanitizeString(searchParams.get("q") ?? "", 80);
  const roleFilter = sanitizeString(searchParams.get("role") ?? "", 20);
  const activeFilter = sanitizeString(searchParams.get("active") ?? "", 10);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const limit = parsePositiveInt(searchParams.get("limit"), 12, 100);
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (q) {
    const pattern = `%${q}%`;
    const searchClause = or(
      ilike(users.fullName, pattern),
      ilike(users.username, pattern),
      ilike(users.employeeCode, pattern),
      ilike(users.position, pattern)
    );
    if (searchClause) conditions.push(searchClause);
  }
  if (roleFilter === "admin" || roleFilter === "employee") {
    conditions.push(eq(users.role, roleFilter));
  }
  if (activeFilter === "true") {
    conditions.push(eq(users.isActive, true));
  } else if (activeFilter === "false") {
    conditions.push(eq(users.isActive, false));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(whereClause);

  const rows = await db
    .select()
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const nextEmployeeCode = await generateNextCode(
    users,
    users.employeeCode,
    "EMP",
    getWibParts().yearMonth
  );

  return NextResponse.json({
    users: rows.map(stripPasswordHash),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    nextEmployeeCode,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminAuth();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const username = sanitizeString(body.username, 50).toLowerCase().replace(/\s+/g, "");
    const fullName = sanitizeString(body.fullName, 100);
    const position = sanitizeString(body.position, 80) || "Karyawan";
    const role = body.role === "admin" ? "admin" : "employee";
    const password = typeof body.password === "string" ? body.password : "";
    const baseSalary = Math.max(0, Math.round(Number(body.baseSalary) || 0));

    if (!username || username.length < 3) {
      return jsonError("Username / ID login minimal 3 karakter tanpa spasi.", 400);
    }
    if (!fullName || fullName.length < 2) {
      return jsonError("Nama lengkap wajib diisi.", 400);
    }
    if (password.length < 5) {
      return jsonError("Password minimal 5 karakter.", 400);
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser) {
      return jsonError(`Username "${username}" sudah terdaftar.`, 409);
    }

    let avatarDataUrl: string | null = null;
    if (typeof body.avatarDataUrl === "string" && body.avatarDataUrl.startsWith("data:image/")) {
      if (body.avatarDataUrl.length <= 250_000) {
        avatarDataUrl = body.avatarDataUrl;
      }
    }

    const passwordHash = await hashPassword(password);
    const yearMonth = getWibParts().yearMonth;

    const created = await withUniqueCodeRetry(async () => {
      const employeeCode = await generateNextCode(
        users,
        users.employeeCode,
        "EMP",
        yearMonth
      );
      const [row] = await db
        .insert(users)
        .values({
          employeeCode,
          username,
          passwordHash,
          fullName,
          role,
          position,
          baseSalary,
          avatarDataUrl,
          isActive: true,
        })
        .returning();
      return row;
    });

    return NextResponse.json({ user: stripPasswordHash(created) }, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return jsonError("Gagal membuat akun karyawan baru.", 500);
  }
}
