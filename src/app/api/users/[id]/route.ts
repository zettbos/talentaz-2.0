import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { jsonError, requireAdminAuth, sanitizeString } from "@/lib/api-helpers";
import { hashPassword, stripPasswordHash } from "@/lib/auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const userId = Number.parseInt(id, 10);
  if (Number.isNaN(userId)) {
    return jsonError("ID karyawan tidak valid.", 400);
  }

  try {
    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target) {
      return jsonError("Karyawan tidak ditemukan.", 404);
    }

    const body = await request.json();
    const updates: Partial<typeof users.$inferInsert> = {};

    if (typeof body.fullName === "string") {
      const fullName = sanitizeString(body.fullName, 100);
      if (fullName.length < 2) return jsonError("Nama lengkap minimal 2 karakter.", 400);
      updates.fullName = fullName;
    }

    if (typeof body.position === "string") {
      updates.position = sanitizeString(body.position, 80) || "Karyawan";
    }

    if (body.role === "admin" || body.role === "employee") {
      if (target.id === auth.user.id && body.role !== "admin") {
        return jsonError("Anda tidak dapat menurunkan peran akun Anda sendiri.", 400);
      }
      updates.role = body.role;
    }

    if (typeof body.baseSalary === "number" || typeof body.baseSalary === "string") {
      const salary = Math.round(Number(body.baseSalary));
      if (Number.isNaN(salary) || salary < 0) {
        return jsonError("Gaji pokok tidak boleh negatif.", 400);
      }
      updates.baseSalary = salary;
    }

    if (typeof body.isActive === "boolean") {
      if (target.id === auth.user.id && !body.isActive) {
        return jsonError("Anda tidak dapat menonaktifkan akun Anda sendiri.", 400);
      }
      updates.isActive = body.isActive;
    }

    if (typeof body.newPassword === "string" && body.newPassword.length > 0) {
      if (body.newPassword.length < 5) {
        return jsonError("Password baru minimal 5 karakter.", 400);
      }
      updates.passwordHash = await hashPassword(body.newPassword);
    }

    if (body.avatarDataUrl === null) {
      updates.avatarDataUrl = null;
    } else if (typeof body.avatarDataUrl === "string" && body.avatarDataUrl.startsWith("data:image/")) {
      if (body.avatarDataUrl.length <= 250_000) {
        updates.avatarDataUrl = body.avatarDataUrl;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ user: stripPasswordHash(target) });
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    return NextResponse.json({ user: stripPasswordHash(updated) });
  } catch (error) {
    console.error("Update user error:", error);
    return jsonError("Gagal memperbarui data karyawan.", 500);
  }
}
