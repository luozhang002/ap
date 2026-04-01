"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Flex, Layout, Space, Tag, Typography } from "antd";
import { getCustomers } from "@/services/customerApi";
import type { Customer } from "@/types/customer";

const { Header, Content } = Layout;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    getCustomers().then(setCustomers);
  }, []);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "0 16px" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Title level={4} style={{ margin: 0 }}>客户列表</Typography.Title>
          <Link href="/visit-map">
            <Button type="primary">拜访地图</Button>
          </Link>
        </Space>
      </Header>
      <Content style={{ padding: 16 }}>
        <Flex vertical gap={12}>
          {customers.map((item) => (
            <Card key={item.id}>
              <p>姓名：{item.name}</p>
              <p>公司：{item.company}</p>
              <p>地址：{item.address}</p>
              <p>
                状态：
                <Tag color={item.visitStatus === "VISITED" ? "red" : "blue"}>
                  {item.visitStatus === "VISITED" ? "已拜访" : "未拜访"}
                </Tag>
              </p>
            </Card>
          ))}
        </Flex>
      </Content>
    </Layout>
  );
}
