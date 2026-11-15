import { requirePageUser } from "@/lib/page-guard";
import { PengaturanClient } from "@/components/PengaturanClient";

export const dynamic = "force-dynamic";

export default async function PengaturanPage() {
  const user = await requirePageUser(true);
  return <PengaturanClient initialUser={user} />;
}
