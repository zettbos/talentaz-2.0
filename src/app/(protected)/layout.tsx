import { redirect } from "next/navigation";
import { ProtectedShell } from "@/components/ProtectedShellContext";
import { getCurrentUser } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <ProtectedShell initialUser={user}>{children}</ProtectedShell>;
}
