import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/jwt";

const COOKIE = "oms_token";

export async function middleware(request: NextRequest) {
  const secret = process.env.JWT_SECRET;
  const token = request.cookies.get(COOKIE)?.value;
  const { pathname } = request.nextUrl;

  const verifyOms = async () => {
    if (!token || !secret) return false;
    try {
      const v = await verifySessionToken(token, secret);
      return Boolean(v && v.app === "oms" && v.role === "ADMIN");
    } catch {
      return false;
    }
  };

  if (pathname.startsWith("/dashboard")) {
    const ok = await verifyOms();
    if (!ok) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (pathname === "/login") {
    const ok = await verifyOms();
    if (ok) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
