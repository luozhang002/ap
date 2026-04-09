import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { verifySessionToken } from "./jwt";

export async function getOmsSession() {
  const token = (await cookies()).get("oms_token")?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  const v = await verifySessionToken(token, secret);
  if (!v || v.app !== "oms" || v.role !== "ADMIN") return null;
  return v;
}

export type SafeUser = {
  id: number;
  username: string;
  name: string;
  role: Role;
};

export async function getOmsUser(): Promise<SafeUser | null> {
  const s = await getOmsSession();
  if (!s) return null;
  const user = await prisma.user.findUnique({ where: { id: s.sub } });
  if (!user || user.role !== Role.ADMIN) return null;
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}
