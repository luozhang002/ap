This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 企业管理（Excel 导入）

**维护说明：** 目前使用的 Excel 列模板与 `EnterpriseRecord` 等数据库模型是**可演进设计**，后续若模板或字段变更，通常需要联动调整：`oms/prisma/schema.prisma`（及与 OMS 共库的 CRM schema 若需同步）、`src/lib/enterprise-headers.ts`、`enterprise-import.ts` / `enterprise-parse.ts`、`enterprise-serialize.ts`、相关 API 路由与 `dashboard/enterprises` 页面展示与导出。

更完整的**迁移说明、多版本模板兼容与改字段检查表**见：[docs/enterprise-excel-schema-evolution.md](docs/enterprise-excel-schema-evolution.md)。

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
