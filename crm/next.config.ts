import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["antd", "@ant-design/icons", "@ant-design/cssinjs", "@amap/amap-jsapi-loader"],
};

export default nextConfig;
