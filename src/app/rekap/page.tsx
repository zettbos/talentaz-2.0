import { requirePageUser } from "@/lib/page-guard";
import { RekapClient } from "@/components/RekapClient";

export const dynamic = "force-dynamic";

export default async function RekapPage() {
  const user = await requirePageUser(false);
  return <RekapClient initialUser={user} />;
}
