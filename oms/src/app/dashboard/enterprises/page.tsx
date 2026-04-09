import { redirect } from "next/navigation";
import { getOmsUser } from "@/lib/session";
import { EnterprisesManagement } from "./EnterprisesManagement";

export default async function EnterprisesPage() {
  const user = await getOmsUser();
  if (!user) redirect("/login");

  return <EnterprisesManagement />;
}
