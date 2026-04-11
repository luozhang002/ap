import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCrmSession, getCrmUser } from "@/lib/session";

export default async function Home() {
  const session = await getCrmSession();
  if (session) {
    const user = await getCrmUser();
    if (user) redirect("/dashboard");
    (await cookies()).delete("crm_token");
  }
  redirect("/login");
}
