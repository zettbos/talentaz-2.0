import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { leaveRequests, users } from "@/db/schema";
import { ensureInitialized } from "@/db/seed";
import {
  jsonError,
  parsePositiveInt,
  requireAuth,
  sanitizeString,
} from "@/lib/api-helpers";
import { generateNextCode, withUniqueCodeRetry } from "@/lib/codes";
import { getWibParts } from "@/lib/time";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  await ensureInitialized();
  const { searchParams } = new URL(request.url);
  const q = sanitizeString(searchParams.get("q") ?? "", 80);
  const statusFilter = sanitizeString(searchParams.get("status") ?? "all", 20);
  const typeFilter = sanitizeString(searchParams.get("leaveType") ?? "all", 20);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const limit = parsePositiveInt(searchParams.get("limit"), 10, 50);
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (auth.user.role !== "admin") {
    conditions.push(eq(leaveRequests.userId, auth.user.id));
  }
  if (statusFilter === "pending" || statusFilter === "approved" || statusFilter === "rejected") {
    conditions.push(eq(leaveRequests.status, statusFilter));
  }
  if (typeFilter === "izin" || typeFilter === "sakit" || typeFilter === "cuti") {
    conditions.push(eq(leaveRequests.leaveType, typeFilter));
  }
  if (q) {
    const pattern = `%${q}%`;
    const searchClause = or(
      ilike(users.fullName, pattern),
      ilike(users.employeeCode, pattern),
      ilike(leaveRequests.requestCode, pattern),
      ilike(leaveRequests.reason, pattern)
    );
    if (searchClause) conditions.push(searchClause);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(leaveRequests)
    .innerJoin(users, eq(leaveRequests.userId, users.id))
    .where(whereClause);

  const rows = await db
    .select({
      id: leaveRequests.id,
      requestCode: leaveRequests.requestCode,
      userId: leaveRequests.userId,
      employeeCode: users.employeeCode,
      fullName: users.fullName,
      position: users.position,
      leaveType: leaveRequests.leaveType,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      reason: leaveRequests.reason,
      attachmentName: leaveRequests.attachmentName,
      attachmentMime: leaveRequests.attachmentMime,
      attachmentDataUrl: leaveRequests.attachmentDataUrl,
      status: leaveRequests.status,
      reviewNote: leaveRequests.reviewNote,
      reviewedAt: leaveRequests.reviewedAt,
      createdAt: leaveRequests.createdAt,
    })
    .from(leaveRequests)
    .innerJoin(users, eq(leaveRequests.userId, users.id))
    .where(whereClause)
    .orderBy(desc(leaveRequests.createdAt))
    .limit(limit)
    .offset(offset);

  const nextRequestCode = await generateNextCode(
    leaveRequests,
    leaveRequests.requestCode,
    "IZN",
    getWibParts().yearMonth
  );

  return NextResponse.json({
    requests: rows,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    nextRequestCode,
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    await ensureInitialized();
    const body = await request.json();
    const leaveType =
      body.leaveType === "sakit" || body.leaveType === "cuti"
        ? body.leaveType
        : "izin";
    const startDate = sanitizeString(body.startDate, 10);
    const endDate = sanitizeString(body.endDate, 10);
    const reason = sanitizeString(body.reason, 500);
    const attachmentName = sanitizeString(body.attachmentName, 160) || null;
    const attachmentMime = sanitizeString(body.attachmentMime, 80) || null;
    const attachmentDataUrl =
      typeof body.attachmentDataUrl === "string" ? body.attachmentDataUrl : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return jsonError("Tanggal mulai dan tanggal selesai wajib valid.", 400);
    }
    if (endDate < startDate) {
      return jsonError("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.", 400);
    }
    if (reason.length < 5) {
      return jsonError("Alasan pengajuan wajib diisi minimal 5 karakter.", 400);
    }
    if (attachmentDataUrl) {
      const validPrefix =
        attachmentDataUrl.startsWith("data:image/") ||
        attachmentDataUrl.startsWith("data:application/pdf");
      if (!validPrefix) {
        return jsonError("Format lampiran harus gambar atau PDF.", 400);
      }
      if (attachmentDataUrl.length > 1_500_000) {
        return jsonError("Ukuran lampiran melebihi batas maksimal 1 MB.", 400);
      }
    }

    const yearMonth = getWibParts().yearMonth;
    const created = await withUniqueCodeRetry(async () => {
      const requestCode = await generateNextCode(
        leaveRequests,
        leaveRequests.requestCode,
        "IZN",
        yearMonth
      );
      const [inserted] = await db
        .insert(leaveRequests)
        .values({
          requestCode,
          userId: auth.user.id,
          leaveType,
          startDate,
          endDate,
          reason,
          attachmentName,
          attachmentMime,
          attachmentDataUrl,
          status: "pending",
        })
        .returning();
      return inserted;
    });

    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    console.error("Create leave request error:", error);
    return jsonError("Gagal mengirim pengajuan izin/cuti.", 500);
  }
}
