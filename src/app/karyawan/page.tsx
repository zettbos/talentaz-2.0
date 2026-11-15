import { requirePageUser } from "@/lib/page-guard";
import { KaryawanClient } from "@/components/KaryawanClient";

export const dynamic = "force-dynamic";

export default async function KaryawanPage() {
  const user = await requirePageUser(true);
  return <KaryawanClient initialUser={user} />;
}
