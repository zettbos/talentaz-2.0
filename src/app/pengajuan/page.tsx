import { requirePageUser } from "@/lib/page-guard";
import { PengajuanClient } from "@/components/PengajuanClient";

export const dynamic = "force-dynamic";

export default async function PengajuanPage() {
  const user = await requirePageUser(false);
  return <PengajuanClient initialUser={user} />;
}
