import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companySettings, overtimeRequests, users } from "@/db/schema";
import {
  jsonError,
  parsePositiveInt,
  requireAuth,
  sanitizeString,
} from "@/lib/api-helpers";
import { generateNextCode, withUniqueCodeRetry } from "@/lib/codes";
import { computeDurationMinutes, getWibParts } from "@/lib/time";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = sanitizeString(searchParams.get("q") ?? "", 80);
  const statusFilter = sanitizeString(searchParams.get("status") ?? "all", 20);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const limit = parsePositiveInt(searchParams.get("limit"), 10, 50);
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (auth.user.role !== "admin") {
    conditions.push(eq(overtimeRequests.userId, auth.user.id));
  }
  if (statusFilter === "pending" || statusFilter === "approved" || statusFilter === "rejected") {
    conditions.push(eq(overtimeRequests.status, statusFilter));
  }
  if (q) {
    const pattern = `%${q}%`;
    const searchClause = or(
      ilike(users.fullName, pattern),
      ilike(users.employeeCode, pattern),
      ilike(overtimeRequests.overtimeCode, pattern),
      ilike(overtimeRequests.taskDescription, pattern)
    );
    if (searchClause) conditions.push(searchClause);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [[{ total }], rows, [settings], nextOvertimeCode] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(overtimeRequests)
      .innerJoin(users, eq(overtimeRequests.userId, users.id))
      .where(whereClause),
    db
      .select({
        id: overtimeRequests.id,
        overtimeCode: overtimeRequests.overtimeCode,
        userId: overtimeRequests.userId,
        employeeCode: users.employeeCode,
        fullName: users.fullName,
        position: users.position,
        overtimeDate: overtimeRequests.overtimeDate,
        startTime: overtimeRequests.startTime,
        endTime: overtimeRequests.endTime,
        durationMinutes: overtimeRequests.durationMinutes,
        taskDescription: overtimeRequests.taskDescription,
        estimatedPay: overtimeRequests.estimatedPay,
        status: overtimeRequests.status,
        reviewNote: overtimeRequests.reviewNote,
        reviewedAt: overtimeRequests.reviewedAt,
        createdAt: overtimeRequests.createdAt,
      })
      .from(overtimeRequests)
      .innerJoin(users, eq(overtimeRequests.userId, users.id))
      .where(whereClause)
      .orderBy(desc(overtimeRequests.createdAt))
      .limit(limit)
      .offset(offset),
    db.select().from(companySettings).limit(1),
    generateNextCode(
      overtimeRequests,
      overtimeRequests.overtimeCode,
      "LMB",
      getWibParts().yearMonth
    ),
  ]);

  return NextResponse.json({
    requests: rows,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    nextOvertimeCode,
    overtimeHourlyRate: settings?.overtimeHourlyRate ?? 25000,
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const overtimeDate = sanitizeString(body.overtimeDate, 10);
    const startTime = sanitizeString(body.startTime, 5);
    const endTime = sanitizeString(body.endTime, 5);
    const taskDescription = sanitizeString(body.taskDescription, 500);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(overtimeDate)) {
      return jsonError("Tanggal lembur wajib valid.", 400);
    }
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      return jsonError("Jam mulai dan jam selesai harus format HH:mm.", 400);
    }
    if (taskDescription.length < 5) {
      return jsonError("Uraian tugas lembur wajib diisi minimal 5 karakter.", 400);
    }

    const durationMinutes = computeDurationMinutes(startTime, endTime);
    if (durationMinutes < 15 || durationMinutes > 720) {
      return jsonError("Durasi lembur harus antara 15 menit hingga 12 jam.", 400);
    }

    const [settings] = await db.select().from(companySettings).limit(1);
    const hourlyRate = settings?.overtimeHourlyRate ?? 25000;
    const estimatedPay = Math.round((durationMinutes / 60) * hourlyRate);
    const yearMonth = getWibParts().yearMonth;

    const created = await withUniqueCodeRetry(async () => {
      const overtimeCode = await generateNextCode(
        overtimeRequests,
        overtimeRequests.overtimeCode,
        "LMB",
        yearMonth
      );
      const [inserted] = await db
        .insert(overtimeRequests)
        .values({
          overtimeCode,
          userId: auth.user.id,
          overtimeDate,
          startTime,
          endTime,
          durationMinutes,
          taskDescription,
          estimatedPay,
          status: "pending",
        })
        .returning();
      return inserted;
    });

    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    console.error("Create overtime request error:", error);
    return jsonError("Gagal mengirim pengajuan lembur.", 500);
  }
}
