"use client";

import "@ant-design/v5-patch-for-react-19";
import { App, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#08979c",
          colorInfo: "#08979c",
          borderRadius: 12,
          fontFamily:
            'var(--font-geist-sans), "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
