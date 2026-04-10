/**
 * 是否在 Set-Cookie 上使用 Secure。
 * - 浏览器直连 http://公网IP:端口 时必须为 false（否则浏览器丢弃 Cookie）；误传的 x-forwarded-proto:https 也要忽略。
 * - 本机 http://127.0.0.1 反代终止 TLS 时，可凭 x-forwarded-proto: https 设为 Secure。
 */
export function cookieSecureFromRequest(req: Request): boolean {
  if (process.env.COOKIE_FORCE_INSECURE === "true") {
    return false;
  }
  const fwd = req.headers.get("x-forwarded-proto");
  const fwdHttps = fwd?.split(",")[0].trim().toLowerCase() === "https";
  try {
    const u = new URL(req.url);
    if (u.protocol === "https:") {
      return true;
    }
    if (u.protocol === "http:") {
      const h = u.hostname;
      const loopback =
        h === "localhost" || h === "127.0.0.1" || h === "::1";
      if (!loopback) {
        return false;
      }
      return fwdHttps;
    }
  } catch {
    /* 相对 URL 等 */
  }
  return fwdHttps;
}
