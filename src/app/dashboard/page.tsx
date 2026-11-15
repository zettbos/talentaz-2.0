import { requirePageUser } from "@/lib/page-guard";
import { DashboardClient } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePageUser(false);
  return <DashboardClient initialUser={user} />;
}
