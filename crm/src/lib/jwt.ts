import { SignJWT, jwtVerify } from "jose";

export type AppClaim = "oms" | "crm";
export type RoleClaim = "ADMIN" | "EMPLOYEE";

export async function signSessionToken(
  payload: { sub: number; role: RoleClaim; app: AppClaim },
  secret: string,
) {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ role: payload.role, app: payload.app })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifySessionToken(token: string, secret: string) {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  const sub = payload.sub ? Number(payload.sub) : NaN;
  const role = payload.role as RoleClaim | undefined;
  const app = payload.app as AppClaim | undefined;
  if (!Number.isFinite(sub) || !role || !app) return null;
  return { sub, role, app };
}
