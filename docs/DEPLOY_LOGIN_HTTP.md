# 生产环境 HTTP 访问时「登录不进去」问题说明

面向：使用 **`http://公网IP:端口`**（例如 `http://43.x.x.x:3000`）直连 OMS/CRM、PM2 部署时出现 **密码错误有提示，密码正确却无法进入后台** 的情况。

---

## 一、现象

| 情况 | 说明 |
|------|------|
| 错密码 | 接口返回「用户名或密码错误」等提示，行为正常。 |
| 对密码 | 登录请求看似成功，跳转 `/dashboard` 后立刻回到 `/login`，或一直卡在登录页。 |

说明 **数据库与登录接口** 多数是正常的，问题出在 **会话 Cookie 是否生效** 或 **鉴权链路是否一致**。

---

## 二、原因概览

### 1. Cookie 的 `Secure` 与纯 HTTP

若 Set-Cookie 带了 **`Secure`**，浏览器**只会**在 **HTTPS** 连接上保存并发送该 Cookie。

历史上若用 `secure: NODE_ENV === "production"`，在 PM2 生产环境下即使用 **HTTP** 访问，也会误加 `Secure`，导致浏览器**丢弃** Cookie，表现为「永远登不进去」。

**当前代码**通过 `cookieSecureFromRequest(req)` 判断：仅在真实 **HTTPS**、或 **本机反代**且 `X-Forwarded-Proto: https` 等合理场景下设 `Secure`；**公网 IP + `http://` 直连**时不再误设 `Secure`。

若仍被中间层误加协议头，可在对应应用的 `.env` 中设置（**仅在不使用 HTTPS 直连时**）：

```env
COOKIE_FORCE_INSECURE=true
```

修改 `.env` 后**重启 PM2** 使进程重新加载环境变量即可；若改的是代码，则需重新 **`npm run build`** 后再重启。

### 2. Edge Middleware 与 `JWT_SECRET` 构建期内联（已用架构调整规避）

Next.js 的 **Middleware** 运行在 **Edge**，其中使用的 `process.env.JWT_SECRET` 会在执行 **`next build`** 时被打进产物。

若出现以下情况：

- 构建时**没有**读到 `oms/.env` / `crm/.env`（例如在 CI 无环境文件、在错误目录构建），或  
- 构建时与运行时的 **`JWT_SECRET` 不一致**，

则会出现：**登录 API（Node 运行时）**能读到当前 `.env` 并签发 JWT，而 **Middleware** 仍用**空或旧密钥**校验 Cookie → **永远验不过**，跳转回登录页。

**当前代码**已**移除** OMS/CRM 中基于 JWT 的 **Middleware 拦截**，改为仅依赖服务端 **`getOmsSession` / `getCrmUser`**（与 `JWT_SECRET` 均在 **`next start` 运行时**读取），避免上述「构建期 / 运行期密钥不一致」问题。

登录页若已登录则通过服务端 **`redirect("/dashboard")`** 处理，与原先 Middleware 中「已登录勿再看登录页」行为等价。

### 3. 其他仍需自检项

- **`JWT_SECRET`**：OMS 与 CRM **必须相同**（见主部署文档）。  
- **OMS 仅管理员**：需 **`Role.ADMIN`** 账号（种子数据示例：`admin` / `Admin123456`）。  
- **数据库**：已 `prisma db push` / migrate，且已按需 **`npm run db:seed`**。  
- **`DATABASE_URL` 密码特殊字符**：`#`、`&`、`@` 等须在 URL 中 **编码**（见 `.env.example` 注释）。

---

## 三、部署与排查清单

1. **在服务器上、应用目录内构建**（保证该目录存在正确的 `.env`）  
   ```bash
   cd /opt/ap/oms && npm ci && npm run build
   cd /opt/ap/crm && npm ci && npm run build
   ```
2. **确认 `oms/.env`、`crm/.env`** 中 **`JWT_SECRET` 一致**，且与线上一致。  
3. **重启 PM2**  
   ```bash
   cd /opt/ap && pm2 restart ecosystem.config.cjs
   ```  
4. 浏览器使用 **无痕窗口** 或清除该站点 Cookie 后再试。  
5. 若仍失败，在开发者工具 **Network** 中查看登录接口响应是否包含 **`Set-Cookie: oms_token=`**（或 `crm_token`），以及后续请求 **Request Headers** 是否带上对应 Cookie。

---

## 四、使用 HTTPS + 反向代理时

对外使用 **Nginx/Caddy** 等终止 TLS 时，请配置：

- **`X-Forwarded-Proto: https`**（若浏览器到反代为 HTTPS），以便在「反代到本机 Node」场景下正确设置 Cookie 的 `Secure`（若 Node 收到的请求 URL 仍为 `http://127.0.0.1:...`，代码会结合该头判断）。

此时一般**不要**再设置 `COOKIE_FORCE_INSECURE=true`。

---

## 五、相关文件（便于维护时对照）

| 说明 | 路径 |
|------|------|
| Cookie 是否 `Secure` | `oms/src/lib/cookie-secure.ts`、`crm/src/lib/cookie-secure.ts` |
| 登录 Set-Cookie | `oms/src/app/api/auth/login/route.ts`、`crm/...` |
| 服务端会话 | `oms/src/lib/session.ts`、`crm/src/lib/session.ts` |
| 登录页已登录跳转 | `oms/src/app/login/page.tsx`、`crm/src/app/login/page.tsx` |

主流程部署仍见：**[DEPLOY_PM2.md](./DEPLOY_PM2.md)**。
