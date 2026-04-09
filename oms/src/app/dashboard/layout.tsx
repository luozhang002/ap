import { redirect } from "next/navigation";
import { getOmsUser } from "@/lib/session";
import { DashboardShell } from "./DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getOmsUser();
  if (!user) redirect("/login");

  return (
    <DashboardShell user={{ id: user.id, username: user.username, name: user.name }}>
      {children}
    </DashboardShell>
  );
}
