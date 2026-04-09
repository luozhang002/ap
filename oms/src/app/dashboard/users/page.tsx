import { redirect } from "next/navigation";
import { getOmsUser } from "@/lib/session";
import { UsersManagement } from "./UsersManagement";

export default async function UsersPage() {
  const user = await getOmsUser();
  if (!user) redirect("/login");

  return (
    <UsersManagement currentUserId={user.id} />
  );
}
