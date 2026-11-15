import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { leaveRequests } from "@/db/schema";
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
    return jsonError("ID pengajuan tidak valid.", 400);
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
      .from(leaveRequests)
      .where(eq(leaveRequests.id, requestId))
      .limit(1);

    if (!existing) {
      return jsonError("Pengajuan tidak ditemukan.", 404);
    }

    const [updated] = await db
      .update(leaveRequests)
      .set({
        status: decision,
        reviewedBy: auth.user.id,
        reviewNote,
        reviewedAt: new Date(),
      })
      .where(eq(leaveRequests.id, requestId))
      .returning();

    return NextResponse.json({ request: updated });
  } catch (error) {
    console.error("Review leave error:", error);
    return jsonError("Gagal memperbarui status pengajuan.", 500);
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
    return jsonError("ID pengajuan tidak valid.", 400);
  }

  const [existing] = await db
    .select()
    .from(leaveRequests)
    .where(eq(leaveRequests.id, requestId))
    .limit(1);

  if (!existing) {
    return jsonError("Pengajuan tidak ditemukan.", 404);
  }
  if (existing.userId !== auth.user.id && auth.user.role !== "admin") {
    return jsonError("Anda tidak berhak membatalkan pengajuan ini.", 403);
  }
  if (existing.status !== "pending") {
    return jsonError("Hanya pengajuan berstatus menunggu yang dapat dibatalkan.", 400);
  }

  await db.delete(leaveRequests).where(eq(leaveRequests.id, requestId));
  return NextResponse.json({ ok: true });
}
