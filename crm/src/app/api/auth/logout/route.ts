import { NextResponse } from "next/server";
import { cookieSecureFromRequest } from "@/lib/cookie-secure";

const COOKIE = "crm_token";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", {
    httpOnly: true,
    secure: cookieSecureFromRequest(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
