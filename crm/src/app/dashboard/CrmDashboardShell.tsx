"use client";

import {
  CompassOutlined,
  HomeOutlined,
  UserOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./dashboard-shell.module.css";

const TABS = [
  {
    href: "/dashboard",
    label: "首页",
    icon: HomeOutlined,
    match: (p: string) => p === "/dashboard" || p === "/dashboard/",
  },
  {
    href: "/dashboard/visit-map",
    label: "陌拜地图",
    icon: CompassOutlined,
    match: (p: string) => p.startsWith("/dashboard/visit-map"),
  },
  {
    href: "/dashboard/me",
    label: "我的",
    icon: UserOutlined,
    match: (p: string) => p.startsWith("/dashboard/me"),
  },
] as const;

export function CrmDashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";

  return (
    <div className={styles.shell}>
      <div className={styles.scroll}>{children}</div>
      <nav className={styles.tabBar} aria-label="主导航">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.tabItem} ${active ? styles.tabItemActive : ""}`}
              prefetch
              aria-current={active ? "page" : undefined}
            >
              <Icon className={styles.tabIcon} />
              <span className={styles.tabLabel}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
