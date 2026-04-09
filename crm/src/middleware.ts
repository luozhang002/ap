import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/jwt";

const COOKIE = "crm_token";

export async function middleware(request: NextRequest) {
  const secret = process.env.JWT_SECRET;
  const token = request.cookies.get(COOKIE)?.value;
  const { pathname } = request.nextUrl;

  const verifyCrm = async () => {
    if (!token || !secret) return false;
    try {
      const v = await verifySessionToken(token, secret);
      return Boolean(v && v.app === "crm" && v.role === "EMPLOYEE");
    } catch {
      return false;
    }
  };

  if (pathname.startsWith("/dashboard")) {
    const ok = await verifyCrm();
    if (!ok) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (pathname === "/login") {
    const ok = await verifyCrm();
    if (ok) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
