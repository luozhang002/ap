import { NextResponse } from "next/server";
import { getOmsUser } from "@/lib/session";

export async function GET() {
  const user = await getOmsUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
