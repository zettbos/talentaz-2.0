import { requirePageUser } from "@/lib/page-guard";
import { AbsenClient } from "@/components/AbsenClient";

export const dynamic = "force-dynamic";

export default async function AbsenPage() {
  const user = await requirePageUser(false);
  return <AbsenClient initialUser={user} />;
}
