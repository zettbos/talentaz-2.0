import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  attendances,
  companySettings,
  leaveRequests,
  overtimeRequests,
  users,
} from "@/db/schema";
import { parsePositiveInt, requireAuth, sanitizeString } from "@/lib/api-helpers";
import type {
  DailyAttendanceRow,
  KopSuratMeta,
  PayrollSummaryRow,
} from "@/lib/report-types";
import { formatWibTimeShort, getWibParts } from "@/lib/time";

function resolveMonthRange(monthParam: string): { startDate: string; endDate: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam);
  const wib = getWibParts();
  const year = match ? Number(match[1]) : Number(wib.workDate.slice(0, 4));
  const month = match ? Number(match[2]) : Number(wib.workDate.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function countInclusiveOverlapDays(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): number {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (end < start) return 0;
  const sTime = Date.parse(`${start}T00:00:00Z`);
  const eTime = Date.parse(`${end}T00:00:00Z`);
  return Math.floor((eTime - sTime) / 86400000) + 1;
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const wibToday = getWibParts().workDate;
  const defaultMonth = wibToday.slice(0, 7);

  const month = sanitizeString(searchParams.get("month") ?? defaultMonth, 7);
  const customStart = sanitizeString(searchParams.get("startDate") ?? "", 10);
  const customEnd = sanitizeString(searchParams.get("endDate") ?? "", 10);
  const q = sanitizeString(searchParams.get("q") ?? "", 80);
  const statusFilter = sanitizeString(searchParams.get("status") ?? "all", 20);
  const exportAll = searchParams.get("exportAll") === "true";
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const limit = parsePositiveInt(searchParams.get("limit"), 15, 100);
  const offset = (page - 1) * limit;

  const fallbackRange = resolveMonthRange(month);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(customStart)
    ? customStart
    : fallbackRange.startDate;
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(customEnd)
    ? customEnd
    : fallbackRange.endDate;

  const userConditions: SQL[] = [eq(users.isActive, true)];
  if (auth.user.role !== "admin") {
    userConditions.push(eq(users.id, auth.user.id));
  }
  if (q) {
    const pattern = `%${q}%`;
    const searchClause = or(
      ilike(users.fullName, pattern),
      ilike(users.employeeCode, pattern),
      ilike(users.position, pattern)
    );
    if (searchClause) userConditions.push(searchClause);
  }

  const periodAttendanceConditions: SQL[] = [
    gte(attendances.workDate, startDate),
    lte(attendances.workDate, endDate),
  ];
  if (auth.user.role !== "admin") {
    periodAttendanceConditions.push(eq(attendances.userId, auth.user.id));
  }

  const leaveConditions: SQL[] = [
    eq(leaveRequests.status, "approved"),
    lte(leaveRequests.startDate, endDate),
    gte(leaveRequests.endDate, startDate),
  ];
  if (auth.user.role !== "admin") {
    leaveConditions.push(eq(leaveRequests.userId, auth.user.id));
  }

  const overtimeConditions: SQL[] = [
    eq(overtimeRequests.status, "approved"),
    gte(overtimeRequests.overtimeDate, startDate),
    lte(overtimeRequests.overtimeDate, endDate),
  ];
  if (auth.user.role !== "admin") {
    overtimeConditions.push(eq(overtimeRequests.userId, auth.user.id));
  }

  // Paginated daily attendance logs matching filters.
  const logConditions: SQL[] = [
    gte(attendances.workDate, startDate),
    lte(attendances.workDate, endDate),
  ];
  if (auth.user.role !== "admin") {
    logConditions.push(eq(attendances.userId, auth.user.id));
  }
  if (statusFilter === "late") {
    logConditions.push(eq(attendances.isLate, true));
  } else if (statusFilter === "outside") {
    const outClause = or(
      eq(attendances.isOutsideIn, true),
      eq(attendances.isOutsideOut, true)
    );
    if (outClause) logConditions.push(outClause);
  } else if (statusFilter === "ontime") {
    logConditions.push(eq(attendances.isLate, false));
  }
  if (q) {
    const pattern = `%${q}%`;
    const searchClause = or(
      ilike(users.fullName, pattern),
      ilike(users.employeeCode, pattern),
      ilike(attendances.attendanceCode, pattern)
    );
    if (searchClause) logConditions.push(searchClause);
  }

  const logWhere = and(...logConditions);

  const logQuery = db
    .select({
      id: attendances.id,
      attendanceCode: attendances.attendanceCode,
      workDate: attendances.workDate,
      userId: attendances.userId,
      employeeCode: users.employeeCode,
      fullName: users.fullName,
      position: users.position,
      clockInAt: attendances.clockInAt,
      clockOutAt: attendances.clockOutAt,
      clockInDistanceMeters: attendances.clockInDistanceMeters,
      clockOutDistanceMeters: attendances.clockOutDistanceMeters,
      isLate: attendances.isLate,
      lateMinutes: attendances.lateMinutes,
      lateReason: attendances.lateReason,
      isOutsideIn: attendances.isOutsideIn,
      outsideInReason: attendances.outsideInReason,
      isOutsideOut: attendances.isOutsideOut,
      outsideOutReason: attendances.outsideOutReason,
      penaltyAmount: attendances.penaltyAmount,
      clockInPhoto: attendances.clockInPhoto,
      clockOutPhoto: attendances.clockOutPhoto,
    })
    .from(attendances)
    .innerJoin(users, eq(attendances.userId, users.id))
    .where(logWhere)
    .orderBy(desc(attendances.workDate), desc(attendances.id));

  const [
    targetUsers,
    periodAttendances,
    approvedLeaves,
    approvedOvertimes,
    [{ totalLogs }],
    rawLogs,
    [settings],
  ] = await Promise.all([
    db
      .select({
        id: users.id,
        employeeCode: users.employeeCode,
        fullName: users.fullName,
        position: users.position,
        baseSalary: users.baseSalary,
      })
      .from(users)
      .where(and(...userConditions))
      .orderBy(users.employeeCode),
    db
      .select({
        userId: attendances.userId,
        isLate: attendances.isLate,
        lateMinutes: attendances.lateMinutes,
        isOutsideIn: attendances.isOutsideIn,
        isOutsideOut: attendances.isOutsideOut,
        penaltyAmount: attendances.penaltyAmount,
      })
      .from(attendances)
      .where(and(...periodAttendanceConditions)),
    db
      .select({
        userId: leaveRequests.userId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
      })
      .from(leaveRequests)
      .where(and(...leaveConditions)),
    db
      .select({
        userId: overtimeRequests.userId,
        durationMinutes: overtimeRequests.durationMinutes,
        estimatedPay: overtimeRequests.estimatedPay,
      })
      .from(overtimeRequests)
      .where(and(...overtimeConditions)),
    db
      .select({ totalLogs: sql<number>`count(*)::int` })
      .from(attendances)
      .innerJoin(users, eq(attendances.userId, users.id))
      .where(logWhere),
    exportAll ? logQuery : logQuery.limit(limit).offset(offset),
    db.select().from(companySettings).limit(1),
  ]);

  const summaryRows: PayrollSummaryRow[] = targetUsers.map((emp) => {
    const empAtt = periodAttendances.filter((a) => a.userId === emp.id);
    const presentDays = empAtt.length;
    const lateCount = empAtt.filter((a) => a.isLate).length;
    const lateMinutesTotal = empAtt.reduce((sum, a) => sum + a.lateMinutes, 0);
    const outsideCount = empAtt.filter((a) => a.isOutsideIn || a.isOutsideOut).length;
    const totalPenalty = empAtt.reduce((sum, a) => sum + a.penaltyAmount, 0);

    const approvedLeaveDays = approvedLeaves
      .filter((l) => l.userId === emp.id)
      .reduce(
        (sum, l) => sum + countInclusiveOverlapDays(l.startDate, l.endDate, startDate, endDate),
        0
      );

    const empOt = approvedOvertimes.filter((o) => o.userId === emp.id);
    const approvedOvertimeMinutes = empOt.reduce((sum, o) => sum + o.durationMinutes, 0);
    const totalOvertimePay = empOt.reduce((sum, o) => sum + o.estimatedPay, 0);
    const estimatedNetSalary = emp.baseSalary - totalPenalty + totalOvertimePay;

    return {
      userId: emp.id,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      position: emp.position,
      baseSalary: emp.baseSalary,
      presentDays,
      lateCount,
      lateMinutesTotal,
      outsideCount,
      approvedLeaveDays,
      approvedOvertimeMinutes,
      totalPenalty,
      totalOvertimePay,
      estimatedNetSalary,
    };
  });

  const dailyLogs: DailyAttendanceRow[] = rawLogs.map((row) => ({
    ...row,
    clockInAt: row.clockInAt ? row.clockInAt.toISOString() : null,
    clockOutAt: row.clockOutAt ? row.clockOutAt.toISOString() : null,
    clockInTime: formatWibTimeShort(row.clockInAt),
    clockOutTime: formatWibTimeShort(row.clockOutAt),
  }));

  const kopSurat: KopSuratMeta = {
    companyName: settings?.companyName ?? "TalentaZ 2.0",
    companyTagline: settings?.companyTagline ?? "Sistem Kehadiran & Operasional SDM",
    companyAddress: settings?.companyAddress ?? "-",
    companyContact: settings?.companyContact ?? "-",
    leaderName: settings?.leaderName ?? "Pimpinan",
    leaderTitle: settings?.leaderTitle ?? "Direktur",
    logoDataUrl: settings?.logoDataUrl ?? null,
  };

  return NextResponse.json({
    startDate,
    endDate,
    summaryRows,
    dailyLogs,
    totalLogs,
    page,
    totalPages: Math.max(1, Math.ceil(totalLogs / limit)),
    kopSurat,
  });
}
