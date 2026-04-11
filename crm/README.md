This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

开发服务器默认端口为 **3001**（见 `package.json` 中 `next dev -p 3001`）。

## 客户经理与企业类别（OMS 数据）

CRM 用登录账号的 **姓名**（`users.name`）与企业管理表中的 **客户经理** 字段（`enterprise_records.ownerName`，与 OMS 列表/导入「客户经理」一致）做匹配（`TRIM` 后比较）。**分中心负责人**（`branchOwnerName`）为客户经理的上级管辖字段，**不参与** CRM 匹配。

若列表为空，请核对用户「姓名」是否与 OMS 中该行的「客户经理」一致。匹配规则变更时需同步 `src/lib/crm-visited-enterprises.ts`、`crm-enterprise-categories.ts`、`crm-record-ownership.ts` 与陌拜地图 pins 接口。

首页「我的企业」来自 `src/lib/crm-visited-enterprises.ts`：按 **客户经理** 汇总**全部**负责企业；「已拜访 / 未拜访」由是否实际上门或是否存在上门时间判定。

## 陌拜地图

入口：登录后底部 Tab **陌拜地图**，或访问 `/dashboard/visit-map`。高德 JS API；**红点未拜访、蓝点已拜访**；全部/未拜访/已拜访筛选、距离筛选、定位与演示参考点；点击标记查看详情，**未拜访**可点「标记为已拜访」（写入 `actuallyVisited`、`actualVisitTime`）。

- 图钉数据：`GET /api/me/visit-map/pins`（与首页相同的客户经理匹配规则）。
- 无坐标时前端会地理编码地址，成功后将坐标写入 `extraJson`：`mapLng` / `mapLat`，并同时写入与 h5 `Customer` 一致的 **`longitude` / `latitude`**（`POST /api/me/enterprise-records/[id]/map-position`）。读取时兼容两种命名。

环境变量与 `mobile/h5` 完全一致（见 `src/lib/amap-env.ts`）：`NEXT_PUBLIC_AMAP_KEY`、`NEXT_PUBLIC_AMAP_SECURITY_JS_CODE`。

若控制台出现 **`FlyDataAuthTask` / `INVALID_USER_SCODE`**：表示高德**安全密钥**校验失败。请在高德开放平台同一应用下核对 **Web 端(JS API) Key** 与 **安全密钥** 是否配对复制正确；修改 `.env.local` 后需**重启** dev。勿在 Key 与安全密钥之间混用不同应用。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
