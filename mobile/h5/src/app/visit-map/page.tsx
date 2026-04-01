"use client";

import Link from "next/link";
import { Button, Layout, Space, Typography } from "antd";
import VisitMap from "@/components/VisitMap";

const { Header, Content } = Layout;

export default function VisitMapPage() {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "0 16px" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Title level={4} style={{ margin: 0 }}>拜访地图</Typography.Title>
          <Link href="/customers">
            <Button>返回列表</Button>
          </Link>
        </Space>
      </Header>
      <Content style={{ padding: 16 }}>
        <VisitMap />
      </Content>
    </Layout>
  );
}
