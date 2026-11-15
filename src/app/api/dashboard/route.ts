import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  attendances,
  companySettings,
  leaveRequests,
  overtimeRequests,
  users,
} from "@/db/schema";
import { requireAuth } from "@/lib/api-helpers";
import {
  formatWibTimeShort,
  getCurrentWeekDaysWib,
  getWibParts,
  parseTimeToMinutes,
} from "@/lib/time";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const now = new Date();
  const wib = getWibParts(now);
  const weekDays = getCurrentWeekDaysWib(now);
  const weekStart = weekDays[0].workDate;
  const weekEnd = weekDays[weekDays.length - 1].workDate;
  const monthPrefix = wib.workDate.slice(0, 7);
  const monthStart = `${monthPrefix}-01`;
  const monthEnd = `${monthPrefix}-31`;
  const isAdmin = auth.user.role === "admin";

  const [
    [settings],
    [activeEmployeesRow],
    [todaySelf],
    todayAttendances,
    [{ pendingLeaves }],
    [{ pendingOvertimes }],
    weekAttendances,
    selfMonthAtt,
    selfMonthOvertimes,
    leaveItems,
    overtimeItems,
    totalMonthAttRows,
  ] = await Promise.all([
    db.select().from(companySettings).limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isActive, true)),
    db
      .select()
      .from(attendances)
      .where(
        and(eq(attendances.userId, auth.user.id), eq(attendances.workDate, wib.workDate))
      )
      .limit(1),
    // Today attendance scope: team-wide for Admin, personal for Employee.
    db
      .select({
        id: attendances.id,
        userId: attendances.userId,
        isLate: attendances.isLate,
        isOutsideIn: attendances.isOutsideIn,
        isOutsideOut: attendances.isOutsideOut,
        clockInAt: attendances.clockInAt,
        clockOutAt: attendances.clockOutAt,
      })
      .from(attendances)
      .where(
        isAdmin
          ? eq(attendances.workDate, wib.workDate)
          : and(eq(attendances.userId, auth.user.id), eq(attendances.workDate, wib.workDate))
      ),
    db
      .select({ pendingLeaves: sql<number>`count(*)::int` })
      .from(leaveRequests)
      .where(
        isAdmin
          ? eq(leaveRequests.status, "pending")
          : and(
              eq(leaveRequests.userId, auth.user.id),
              eq(leaveRequests.status, "pending")
            )
      ),
    db
      .select({ pendingOvertimes: sql<number>`count(*)::int` })
      .from(overtimeRequests)
      .where(
        isAdmin
          ? eq(overtimeRequests.status, "pending")
          : and(
              eq(overtimeRequests.userId, auth.user.id),
              eq(overtimeRequests.status, "pending")
            )
      ),
    // Weekly work hours bar chart from real attendance timestamps.
    db
      .select({
        id: attendances.id,
        attendanceCode: attendances.attendanceCode,
        workDate: attendances.workDate,
        userId: attendances.userId,
        fullName: users.fullName,
        clockInAt: attendances.clockInAt,
        clockOutAt: attendances.clockOutAt,
        isLate: attendances.isLate,
        isOutsideIn: attendances.isOutsideIn,
      })
      .from(attendances)
      .innerJoin(users, eq(attendances.userId, users.id))
      .where(
        and(
          gte(attendances.workDate, weekStart),
          lte(attendances.workDate, weekEnd),
          ...(isAdmin ? [] : [eq(attendances.userId, auth.user.id)])
        )
      )
      .orderBy(desc(attendances.workDate), desc(attendances.id)),
    // Monthly personal summary for profile badge & payroll breakdown accordion.
    db
      .select({
        isLate: attendances.isLate,
        penaltyAmount: attendances.penaltyAmount,
      })
      .from(attendances)
      .where(
        and(
          eq(attendances.userId, auth.user.id),
          gte(attendances.workDate, monthStart),
          lte(attendances.workDate, monthEnd)
        )
      ),
    db
      .select({
        durationMinutes: overtimeRequests.durationMinutes,
        estimatedPay: overtimeRequests.estimatedPay,
      })
      .from(overtimeRequests)
      .where(
        and(
          eq(overtimeRequests.userId, auth.user.id),
          eq(overtimeRequests.status, "approved"),
          gte(overtimeRequests.overtimeDate, monthStart),
          lte(overtimeRequests.overtimeDate, monthEnd)
        )
      ),
    // Pending approvals for Admin checklist, or recent personal items for Employee.
    db
      .select({
        id: leaveRequests.id,
        code: leaveRequests.requestCode,
        fullName: users.fullName,
        leaveType: leaveRequests.leaveType,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        attachmentDataUrl: leaveRequests.attachmentDataUrl,
        attachmentName: leaveRequests.attachmentName,
      })
      .from(leaveRequests)
      .innerJoin(users, eq(leaveRequests.userId, users.id))
      .where(
        isAdmin
          ? eq(leaveRequests.status, "pending")
          : eq(leaveRequests.userId, auth.user.id)
      )
      .orderBy(desc(leaveRequests.createdAt))
      .limit(5),
    db
      .select({
        id: overtimeRequests.id,
        code: overtimeRequests.overtimeCode,
        fullName: users.fullName,
        overtimeDate: overtimeRequests.overtimeDate,
        startTime: overtimeRequests.startTime,
        endTime: overtimeRequests.endTime,
        durationMinutes: overtimeRequests.durationMinutes,
        taskDescription: overtimeRequests.taskDescription,
        estimatedPay: overtimeRequests.estimatedPay,
        status: overtimeRequests.status,
      })
      .from(overtimeRequests)
      .innerJoin(users, eq(overtimeRequests.userId, users.id))
      .where(
        isAdmin
          ? eq(overtimeRequests.status, "pending")
          : eq(overtimeRequests.userId, auth.user.id)
      )
      .orderBy(desc(overtimeRequests.createdAt))
      .limit(5),
    // Monthly rates for top progress pill bar.
    db
      .select({
        isLate: attendances.isLate,
        isOutsideIn: attendances.isOutsideIn,
      })
      .from(attendances)
      .where(
        and(
          gte(attendances.workDate, monthStart),
          lte(attendances.workDate, monthEnd),
          ...(isAdmin ? [] : [eq(attendances.userId, auth.user.id)])
        )
      ),
  ]);

  const activeEmployees = activeEmployeesRow?.count ?? 0;
  const presentToday = todayAttendances.length;
  const lateToday = todayAttendances.filter((a) => a.isLate).length;
  const outsideToday = todayAttendances.filter(
    (a) => a.isOutsideIn || a.isOutsideOut
  ).length;
  const onTimeToday = todayAttendances.filter((a) => !a.isLate).length;

  const weeklyBars = weekDays.map((day) => {
    const dayRows = weekAttendances.filter((a) => a.workDate === day.workDate);
    let totalMinutes = 0;
    for (const r of dayRows) {
      if (r.clockInAt && r.clockOutAt) {
        totalMinutes += Math.max(
          0,
          Math.round((r.clockOutAt.getTime() - r.clockInAt.getTime()) / 60000)
        );
      } else if (r.clockInAt && day.workDate === wib.workDate) {
        totalMinutes += Math.max(
          0,
          Math.round((now.getTime() - r.clockInAt.getTime()) / 60000)
        );
      }
    }
    const divisor = isAdmin && dayRows.length > 0 ? dayRows.length : 1;
    const avgMinutes = Math.round(totalMinutes / divisor);
    return {
      workDate: day.workDate,
      labelShort: day.labelShort,
      dayNumber: day.dayNumber,
      totalHours: Number((avgMinutes / 60).toFixed(1)),
      totalMinutes: avgMinutes,
      count: dayRows.length,
      isToday: day.workDate === wib.workDate,
    };
  });

  const selfPresentDays = selfMonthAtt.length;
  const selfLateCount = selfMonthAtt.filter((a) => a.isLate).length;
  const selfTotalPenalty = selfMonthAtt.reduce((s, a) => s + a.penaltyAmount, 0);
  const selfOvertimeMinutes = selfMonthOvertimes.reduce(
    (s, o) => s + o.durationMinutes,
    0
  );
  const selfOvertimePay = selfMonthOvertimes.reduce(
    (s, o) => s + o.estimatedPay,
    0
  );
  const selfNetEstimate =
    auth.user.baseSalary - selfTotalPenalty + selfOvertimePay;

  // Scheduled vs elapsed shift tracker minutes for today.
  const startMin = parseTimeToMinutes(settings?.workStartTime ?? "08:00");
  const endMin = parseTimeToMinutes(settings?.workEndTime ?? "17:00");
  const scheduledShiftMinutes = Math.max(60, endMin - startMin);
  let workedTodayMinutes = 0;
  if (todaySelf?.clockInAt) {
    const endAnchor = todaySelf.clockOutAt ?? now;
    workedTodayMinutes = Math.max(
      0,
      Math.round((endAnchor.getTime() - todaySelf.clockInAt.getTime()) / 60000)
    );
  }

  const monthTotal = totalMonthAttRows.length;
  const monthOnTime = totalMonthAttRows.filter((a) => !a.isLate).length;
  const monthLate = totalMonthAttRows.filter((a) => a.isLate).length;
  const monthOutside = totalMonthAttRows.filter((a) => a.isOutsideIn).length;

  const attendancePct =
    isAdmin && activeEmployees > 0
      ? Math.min(100, Math.round((presentToday / activeEmployees) * 100))
      : todaySelf?.clockInAt
        ? 100
        : 0;
  const onTimePct = monthTotal > 0 ? Math.round((monthOnTime / monthTotal) * 100) : 0;
  const latePct = monthTotal > 0 ? Math.round((monthLate / monthTotal) * 100) : 0;
  const outsidePct =
    monthTotal > 0 ? Math.round((monthOutside / monthTotal) * 100) : 0;

  return NextResponse.json({
    user: auth.user,
    settings,
    wibNow: wib,
    todaySelf: todaySelf
      ? {
          id: todaySelf.id,
          attendanceCode: todaySelf.attendanceCode,
          clockInTime: formatWibTimeShort(todaySelf.clockInAt),
          clockOutTime: formatWibTimeShort(todaySelf.clockOutAt),
          isLate: todaySelf.isLate,
          lateMinutes: todaySelf.lateMinutes,
          isOutsideIn: todaySelf.isOutsideIn,
          penaltyAmount: todaySelf.penaltyAmount,
        }
      : null,
    shiftTracker: {
      workedTodayMinutes,
      scheduledShiftMinutes,
      progressPct: Math.min(
        100,
        Math.round((workedTodayMinutes / scheduledShiftMinutes) * 100)
      ),
    },
    kpis: {
      activeEmployees,
      presentToday,
      onTimeToday,
      lateToday,
      outsideToday,
      pendingTotal: pendingLeaves + pendingOvertimes,
      pendingLeaves,
      pendingOvertimes,
      attendancePct,
      onTimePct,
      latePct,
      outsidePct,
    },
    weeklyBars,
    timelineLogs: weekAttendances.slice(0, 6).map((item) => ({
      id: item.id,
      code: item.attendanceCode,
      workDate: item.workDate,
      fullName: item.fullName,
      clockInTime: formatWibTimeShort(item.clockInAt),
      clockOutTime: formatWibTimeShort(item.clockOutAt),
      isLate: item.isLate,
      isOutsideIn: item.isOutsideIn,
    })),
    personalMonthStats: {
      presentDays: selfPresentDays,
      lateCount: selfLateCount,
      totalPenalty: selfTotalPenalty,
      overtimeMinutes: selfOvertimeMinutes,
      overtimePay: selfOvertimePay,
      estimatedNetSalary: selfNetEstimate,
    },
    leaveItems,
    overtimeItems,
  });
}
