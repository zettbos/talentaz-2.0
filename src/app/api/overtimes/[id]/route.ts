import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { overtimeRequests } from "@/db/schema";
import {
  jsonError,
  requireAdminAuth,
  requireAuth,
  sanitizeString,
} from "@/lib/api-helpers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const requestId = Number.parseInt(id, 10);
  if (Number.isNaN(requestId)) {
    return jsonError("ID pengajuan lembur tidak valid.", 400);
  }

  try {
    const body = await request.json();
    const decision = body.status === "approved" ? "approved" : body.status === "rejected" ? "rejected" : null;
    if (!decision) {
      return jsonError("Status persetujuan harus approved atau rejected.", 400);
    }
    const reviewNote = sanitizeString(body.reviewNote, 300) || null;

    const [existing] = await db
      .select()
      .from(overtimeRequests)
      .where(eq(overtimeRequests.id, requestId))
      .limit(1);

    if (!existing) {
      return jsonError("Pengajuan lembur tidak ditemukan.", 404);
    }

    const [updated] = await db
      .update(overtimeRequests)
      .set({
        status: decision,
        reviewedBy: auth.user.id,
        reviewNote,
        reviewedAt: new Date(),
      })
      .where(eq(overtimeRequests.id, requestId))
      .returning();

    return NextResponse.json({ request: updated });
  } catch (error) {
    console.error("Review overtime error:", error);
    return jsonError("Gagal memperbarui status lembur.", 500);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const requestId = Number.parseInt(id, 10);
  if (Number.isNaN(requestId)) {
    return jsonError("ID pengajuan lembur tidak valid.", 400);
  }

  const [existing] = await db
    .select()
    .from(overtimeRequests)
    .where(eq(overtimeRequests.id, requestId))
    .limit(1);

  if (!existing) {
    return jsonError("Pengajuan lembur tidak ditemukan.", 404);
  }
  if (existing.userId !== auth.user.id && auth.user.role !== "admin") {
    return jsonError("Anda tidak berhak membatalkan pengajuan ini.", 403);
  }
  if (existing.status !== "pending") {
    return jsonError("Hanya pengajuan menunggu yang dapat dibatalkan.", 400);
  }

  await db.delete(overtimeRequests).where(eq(overtimeRequests.id, requestId));
  return NextResponse.json({ ok: true });
}
