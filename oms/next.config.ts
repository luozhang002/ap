import type { NextConfig } from "next";

const extraDevHosts =
  process.env.NEXT_DEV_ALLOWED_HOSTS?.split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.localhost",
    "*.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    ...extraDevHosts,
  ],
  transpilePackages: ["antd", "@ant-design/icons", "@ant-design/cssinjs"],
  // 必须：否则 webpack 会把 @prisma/client 打进服务端 bundle，运行时 delegate（如 enterpriseRecord）会变成 undefined，出现 .count / .findMany 报错
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
