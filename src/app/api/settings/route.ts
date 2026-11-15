import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companySettings } from "@/db/schema";
import {
  jsonError,
  requireAdminAuth,
  requireAuth,
  sanitizeString,
} from "@/lib/api-helpers";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const [settings] = await db.select().from(companySettings).limit(1);
  return NextResponse.json({ settings: settings ?? null });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminAuth();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();

    const companyName = sanitizeString(body.companyName, 120);
    const companyTagline = sanitizeString(body.companyTagline, 180);
    const companyAddress = sanitizeString(body.companyAddress, 250);
    const companyContact = sanitizeString(body.companyContact, 180);
    const leaderName = sanitizeString(body.leaderName, 120);
    const leaderTitle = sanitizeString(body.leaderTitle, 120);
    const workStartTime = sanitizeString(body.workStartTime, 5);
    const workEndTime = sanitizeString(body.workEndTime, 5);

    const officeLat = Number(body.officeLat);
    const officeLng = Number(body.officeLng);
    const radiusMeters = Number(body.radiusMeters);
    const lateGraceMinutes = Number(body.lateGraceMinutes);
    const latePenaltyAmount = Number(body.latePenaltyAmount);
    const overtimeHourlyRate = Number(body.overtimeHourlyRate);

    if (!companyName || !companyAddress || !leaderName) {
      return jsonError("Nama perusahaan, alamat, dan nama pimpinan wajib diisi.", 400);
    }
    if (!/^\d{2}:\d{2}$/.test(workStartTime) || !/^\d{2}:\d{2}$/.test(workEndTime)) {
      return jsonError("Format jam kerja harus HH:mm.", 400);
    }
    if (Number.isNaN(officeLat) || Number.isNaN(officeLng)) {
      return jsonError("Koordinat lokasi kantor tidak valid.", 400);
    }
    if (Number.isNaN(radiusMeters) || radiusMeters < 10 || radiusMeters > 50000) {
      return jsonError("Radius lokasi harus antara 10 hingga 50.000 meter.", 400);
    }
    if (Number.isNaN(lateGraceMinutes) || lateGraceMinutes < 0 || lateGraceMinutes > 180) {
      return jsonError("Toleransi keterlambatan harus antara 0 hingga 180 menit.", 400);
    }
    if (Number.isNaN(latePenaltyAmount) || latePenaltyAmount < 0) {
      return jsonError("Nominal potongan telat tidak boleh negatif.", 400);
    }
    if (Number.isNaN(overtimeHourlyRate) || overtimeHourlyRate < 0) {
      return jsonError("Tarif lembur per jam tidak boleh negatif.", 400);
    }

    let logoDataUrl: string | null | undefined = undefined;
    if (body.logoDataUrl === null) {
      logoDataUrl = null;
    } else if (typeof body.logoDataUrl === "string" && body.logoDataUrl.startsWith("data:image/")) {
      if (body.logoDataUrl.length > 350_000) {
        return jsonError("Ukuran logo kop surat terlalu besar.", 400);
      }
      logoDataUrl = body.logoDataUrl;
    }

    const [existing] = await db.select().from(companySettings).limit(1);
    const updatePayload = {
      companyName,
      companyTagline: companyTagline || "Sistem Kehadiran & Operasional SDM",
      companyAddress,
      companyContact: companyContact || "-",
      leaderName,
      leaderTitle: leaderTitle || "Pimpinan",
      officeLat,
      officeLng,
      radiusMeters: Math.round(radiusMeters),
      workStartTime,
      workEndTime,
      lateGraceMinutes: Math.round(lateGraceMinutes),
      latePenaltyAmount: Math.round(latePenaltyAmount),
      overtimeHourlyRate: Math.round(overtimeHourlyRate),
      updatedAt: new Date(),
      ...(logoDataUrl !== undefined ? { logoDataUrl } : {}),
    };

    if (!existing) {
      const [inserted] = await db
        .insert(companySettings)
        .values({ id: 1, ...updatePayload })
        .returning();
      return NextResponse.json({ settings: inserted });
    }

    const [updated] = await db
      .update(companySettings)
      .set(updatePayload)
      .where(eq(companySettings.id, existing.id))
      .returning();

    return NextResponse.json({ settings: updated });
  } catch (error) {
    console.error("Update settings error:", error);
    return jsonError("Gagal menyimpan pengaturan.", 500);
  }
}
