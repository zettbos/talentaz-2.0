import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users, type UserRecord } from "@/db/schema";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "./session";

export {
  SESSION_COOKIE_NAME,
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
  type SessionPayload,
} from "./session";

export type SafeUser = Omit<UserRecord, "passwordHash">;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function stripPasswordHash(user: UserRecord): SafeUser {
  const { passwordHash: _removed, ...safe } = user;
  void _removed;
  return safe;
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = verifySessionToken(rawToken);
  if (!payload) return null;

  const [user] = await db
    .select({
      id: users.id,
      employeeCode: users.employeeCode,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      position: users.position,
      baseSalary: users.baseSalary,
      avatarDataUrl: users.avatarDataUrl,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, payload.uid), eq(users.isActive, true)))
    .limit(1);

  return user ?? null;
}
