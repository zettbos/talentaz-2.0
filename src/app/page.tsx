import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  redirect(session ? "/dashboard" : "/login");
}
