import { like, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";

export async function generateNextCode(
  table: PgTable,
  codeColumn: PgColumn,
  prefix: string,
  period: string
): Promise<string> {
  const pattern = `${prefix}-${period}-%`;
  const [row] = await db
    .select({
      maxCode: sql<string | null>`max(${codeColumn})`,
    })
    .from(table)
    .where(like(codeColumn, pattern));

  let nextSeq = 1;
  if (row?.maxCode) {
    const parts = row.maxCode.split("-");
    const last = Number(parts[parts.length - 1]);
    if (!Number.isNaN(last) && last >= 1) {
      nextSeq = last + 1;
    }
  }

  return `${prefix}-${period}-${String(nextSeq).padStart(3, "0")}`;
}

export async function withUniqueCodeRetry<T>(
  operation: (attempt: number) => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (code === "23505" && attempt < maxAttempts) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
