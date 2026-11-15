import { redirect } from "next/navigation";
import { getCurrentUser, type SafeUser } from "./auth";

export async function requirePageUser(adminOnly = false): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (adminOnly && user.role !== "admin") {
    redirect("/dashboard");
  }
  return user;
}
