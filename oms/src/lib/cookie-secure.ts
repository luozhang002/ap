/**
 * 是否在 Set-Cookie 上使用 Secure。
 * 仅在真实 HTTPS（或反代终止 TLS 且 x-forwarded-proto: https）时为 true。
 * 用 http://公网IP:端口 部署时不能仅按 NODE_ENV 设 secure，否则浏览器会丢弃 Cookie。
 */
export function cookieSecureFromRequest(req: Request): boolean {
  const fwd = req.headers.get("x-forwarded-proto");
  if (fwd) {
    return fwd.split(",")[0].trim().toLowerCase() === "https";
  }
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}
