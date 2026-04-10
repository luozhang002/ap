import type { NextConfig } from "next";

const extraDevHosts =
  process.env.NEXT_DEV_ALLOWED_HOSTS?.split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  // dev 下 blockCrossSiteDEV 会校验 /_next Origin；通配符规则见 next/dist/server/app-render/csrf-protection.js
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.localhost",
    "*.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    ...extraDevHosts,
  ],
  transpilePackages: ["antd", "@ant-design/icons", "@ant-design/cssinjs", "@amap/amap-jsapi-loader"],
};

export default nextConfig;
