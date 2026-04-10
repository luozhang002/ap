import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { verifySessionToken } from "./jwt";

export async function getCrmSession() {
  const token = (await cookies()).get("crm_token")?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  try {
    const v = await verifySessionToken(token, secret);
    if (!v || v.app !== "crm" || v.role !== "EMPLOYEE") return null;
    return v;
  } catch {
    return null;
  }
}

export type SafeUser = {
  id: number;
  username: string;
  name: string;
  role: Role;
};

export async function getCrmUser(): Promise<SafeUser | null> {
  const s = await getCrmSession();
  if (!s) return null;
  const user = await prisma.user.findUnique({ where: { id: s.sub } });
  if (!user || user.role !== Role.EMPLOYEE) return null;
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}
