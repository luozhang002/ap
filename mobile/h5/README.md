This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## 高德地图（H5）

若拜访地图只有**灰底网格、无道路瓦片**，通常是未配置 **安全密钥**。高德 JS API 2.0 要求在加载 SDK 前设置 `securityJsCode`。

1. 登录 [高德开放平台](https://lbs.amap.com/)，创建或选用 **Web 端（JS API）** 的 Key（与 Android 原生 Key 可分开）。
2. 在同一应用下复制 **安全密钥**。
3. 在项目根目录新建 `.env.local`（可参考 `.env.example`）：

```bash
NEXT_PUBLIC_AMAP_KEY=你的Web端Key
NEXT_PUBLIC_AMAP_SECURITY_JS_CODE=你的安全密钥
```

4. 重启 `npm run dev`。本地调试时请在控制台为该 Key 配置 **域名白名单**（如 `localhost`）。

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
