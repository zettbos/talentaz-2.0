import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cachedDb: NeonHttpDatabase<typeof schema> | null = null;

// Defer Neon client initialization until query time so `next build` succeeds before `.env.local` is populated.
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (cachedDb) return cachedDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL belum diatur. Tambahkan ke .env.local atau Vercel Environment Variables."
    );
  }
  const sql = neon(url);
  cachedDb = drizzle(sql, { schema });
  return cachedDb;
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});
