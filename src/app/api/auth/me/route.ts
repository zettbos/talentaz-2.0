import { NextResponse } from "next/server";
import { db } from "@/db";
import { companySettings } from "@/db/schema";
import { requireAuth } from "@/lib/api-helpers";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const [settings] = await db.select().from(companySettings).limit(1);
  return NextResponse.json({
    user: auth.user,
    settings: settings ?? null,
  });
}
