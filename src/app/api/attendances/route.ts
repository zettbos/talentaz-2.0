import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendances, companySettings, users } from "@/db/schema";
import { ensureInitialized } from "@/db/seed";
import {
  jsonError,
  parsePositiveInt,
  requireAuth,
  sanitizeString,
} from "@/lib/api-helpers";
import { generateNextCode, withUniqueCodeRetry } from "@/lib/codes";
import { haversineMeters } from "@/lib/geo";
import {
  computeLateStatus,
  formatWibTimeShort,
  getWibParts,
} from "@/lib/time";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  await ensureInitialized();
  const { searchParams } = new URL(request.url);
  const q = sanitizeString(searchParams.get("q") ?? "", 80);
  const dateFilter = sanitizeString(searchParams.get("date") ?? "", 10);
  const statusFilter = sanitizeString(searchParams.get("status") ?? "all", 20);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const limit = parsePositiveInt(searchParams.get("limit"), 12, 50);
  const offset = (page - 1) * limit;

  const wibToday = getWibParts().workDate;
  const [settings] = await db.select().from(companySettings).limit(1);

  const [todayRecord] = await db
    .select()
    .from(attendances)
    .where(
      and(eq(attendances.userId, auth.user.id), eq(attendances.workDate, wibToday))
    )
    .limit(1);

  const conditions: SQL[] = [];
  if (auth.user.role !== "admin") {
    conditions.push(eq(attendances.userId, auth.user.id));
  }
  if (dateFilter && /^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) {
    conditions.push(eq(attendances.workDate, dateFilter));
  }
  if (statusFilter === "late") {
    conditions.push(eq(attendances.isLate, true));
  } else if (statusFilter === "outside") {
    const outClause = or(
      eq(attendances.isOutsideIn, true),
      eq(attendances.isOutsideOut, true)
    );
    if (outClause) conditions.push(outClause);
  } else if (statusFilter === "ontime") {
    conditions.push(eq(attendances.isLate, false));
  }

  if (q) {
    const pattern = `%${q}%`;
    const searchClause = or(
      ilike(users.fullName, pattern),
      ilike(users.employeeCode, pattern),
      ilike(attendances.attendanceCode, pattern)
    );
    if (searchClause) conditions.push(searchClause);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(attendances)
    .innerJoin(users, eq(attendances.userId, users.id))
    .where(whereClause);

  const rows = await db
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
      clockInPhoto: attendances.clockInPhoto,
      clockOutPhoto: attendances.clockOutPhoto,
      clockInLat: attendances.clockInLat,
      clockInLng: attendances.clockInLng,
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
    })
    .from(attendances)
    .innerJoin(users, eq(attendances.userId, users.id))
    .where(whereClause)
    .orderBy(desc(attendances.workDate), desc(attendances.id))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({
    today: todayRecord ?? null,
    settings: settings ?? null,
    records: rows.map((row) => ({
      ...row,
      clockInTime: formatWibTimeShort(row.clockInAt),
      clockOutTime: formatWibTimeShort(row.clockOutAt),
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    await ensureInitialized();
    const body = await request.json();
    const action = body.action === "clock_out" ? "clock_out" : "clock_in";
    const photoDataUrl = typeof body.photoDataUrl === "string" ? body.photoDataUrl : "";
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const lateReason = sanitizeString(body.lateReason, 400);
    const outsideReason = sanitizeString(body.outsideReason, 400);

    if (!photoDataUrl.startsWith("data:image/")) {
      return jsonError("Foto selfie dari kamera wajib diambil terlebih dahulu.", 400);
    }
    if (photoDataUrl.length > 350_000) {
      return jsonError("Ukuran foto selfie terlalu besar setelah kompresi.", 400);
    }
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return jsonError("Lokasi GPS wajib terdeteksi sebelum melakukan absensi.", 400);
    }

    const [settings] = await db.select().from(companySettings).limit(1);
    if (!settings) {
      return jsonError("Pengaturan kantor belum tersedia.", 500);
    }

    const now = new Date();
    const wib = getWibParts(now);
    const distanceMeters = haversineMeters(
      lat,
      lng,
      settings.officeLat,
      settings.officeLng
    );
    const isOutside = distanceMeters > settings.radiusMeters;

    if (isOutside && outsideReason.length < 5) {
      return jsonError(
        `Lokasi Anda berjarak ${distanceMeters} m dari kantor (batas ${settings.radiusMeters} m). Wajib isi alasan minimal 5 karakter.`,
        400
      );
    }

    const [todayRecord] = await db
      .select()
      .from(attendances)
      .where(
        and(
          eq(attendances.userId, auth.user.id),
          eq(attendances.workDate, wib.workDate)
        )
      )
      .limit(1);

    if (action === "clock_in") {
      if (todayRecord && todayRecord.clockInAt) {
        return jsonError("Anda sudah melakukan Absen Masuk hari ini.", 409);
      }

      const lateCheck = computeLateStatus(
        wib.minutesSinceMidnight,
        settings.workStartTime,
        settings.lateGraceMinutes
      );

      if (lateCheck.isLate && lateReason.length < 5) {
        return jsonError(
          `Anda terlambat ${lateCheck.lateMinutes} menit dari jam masuk ${settings.workStartTime}. Wajib isi alasan terlambat minimal 5 karakter.`,
          400
        );
      }

      const penaltyAmount = lateCheck.isLate ? settings.latePenaltyAmount : 0;

      const created = await withUniqueCodeRetry(async () => {
        const attendanceCode = await generateNextCode(
          attendances,
          attendances.attendanceCode,
          "ABS",
          wib.yyyymmdd
        );
        const [inserted] = await db
          .insert(attendances)
          .values({
            attendanceCode,
            userId: auth.user.id,
            workDate: wib.workDate,
            clockInAt: now,
            clockInPhoto: photoDataUrl,
            clockInLat: lat,
            clockInLng: lng,
            clockInDistanceMeters: distanceMeters,
            isLate: lateCheck.isLate,
            lateMinutes: lateCheck.lateMinutes,
            lateReason: lateCheck.isLate ? lateReason : null,
            isOutsideIn: isOutside,
            outsideInReason: isOutside ? outsideReason : null,
            penaltyAmount,
          })
          .returning();
        return inserted;
      });

      return NextResponse.json({ attendance: created }, { status: 201 });
    }

    // Clock-out flow requires an existing clock-in record for today.
    if (!todayRecord || !todayRecord.clockInAt) {
      return jsonError("Anda belum melakukan Absen Masuk hari ini.", 400);
    }
    if (todayRecord.clockOutAt) {
      return jsonError("Anda sudah melakukan Absen Pulang hari ini.", 409);
    }

    const [updated] = await db
      .update(attendances)
      .set({
        clockOutAt: now,
        clockOutPhoto: photoDataUrl,
        clockOutLat: lat,
        clockOutLng: lng,
        clockOutDistanceMeters: distanceMeters,
        isOutsideOut: isOutside,
        outsideOutReason: isOutside ? outsideReason : null,
      })
      .where(eq(attendances.id, todayRecord.id))
      .returning();

    return NextResponse.json({ attendance: updated });
  } catch (error) {
    console.error("Attendance submit error:", error);
    return jsonError("Gagal menyimpan data absensi.", 500);
  }
}
