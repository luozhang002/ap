import { redirect } from "next/navigation";
import { getCrmSession } from "@/lib/session";

export default async function Home() {
  const session = await getCrmSession();
  if (session) redirect("/dashboard");
  redirect("/login");
}
