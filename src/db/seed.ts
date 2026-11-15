import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { companySettings, users } from "./schema";
import { getWibParts } from "@/lib/time";

let initPromise: Promise<void> | null = null;

async function runBootstrap(): Promise<void> {
  const existingSettings = await db
    .select({ id: companySettings.id })
    .from(companySettings)
    .limit(1);

  if (existingSettings.length === 0) {
    await db
      .insert(companySettings)
      .values({
        id: 1,
        companyName: "TalentaZ 2.0",
        companyTagline: "Sistem Kehadiran & Operasional SDM",
        companyAddress: "Jl. Merdeka No. 1, Jakarta Pusat",
        companyContact: "Telp: (021) 555-0199 | Email: hr@talentaz.local",
        leaderName: "Pimpinan Perusahaan",
        leaderTitle: "Direktur Operasional",
        officeLat: -6.175392,
        officeLng: 106.827153,
        radiusMeters: 150,
        workStartTime: "08:00",
        workEndTime: "17:00",
        lateGraceMinutes: 10,
        latePenaltyAmount: 25000,
        overtimeHourlyRate: 25000,
      })
      .onConflictDoNothing();
  }

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users);

  if (total === 0) {
    const wib = getWibParts();
    const passwordHash = await bcrypt.hash("admin123", 10);
    await db
      .insert(users)
      .values({
        employeeCode: `EMP-${wib.yearMonth}-001`,
        username: "admin",
        passwordHash,
        fullName: "Administrator HR",
        role: "admin",
        position: "HR & Operasional",
        baseSalary: 0,
        isActive: true,
      })
      .onConflictDoNothing();
  }
}

export async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = runBootstrap().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
}
