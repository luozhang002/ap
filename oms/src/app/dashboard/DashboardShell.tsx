"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutButton } from "./LogoutButton";
import styles from "./DashboardShell.module.css";

function IconBank() {
  return (
    <svg className={styles.menuIcon} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zm6 0v7h3v-7h-3zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm2-18h1V7h2V4h2v3h2V4h2v3h2V4h2v3h1v2H4z" />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg className={styles.menuIcon} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.84 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  );
}

export type DashboardUser = {
  id: number;
  username: string;
  name: string;
};

export function DashboardShell({
  user,
  children,
}: {
  user: DashboardUser;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";

  return (
    <div className={styles.root}>
      <aside className={styles.sider}>
        <div className={styles.logo}>OMS</div>
        <nav className={styles.nav} aria-label="主导航">
          <Link
            href="/dashboard/enterprises"
            className={
              pathname.startsWith("/dashboard/enterprises") ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
            }
          >
            <IconBank />
            企业管理
          </Link>
          <Link
            href="/dashboard/users"
            className={
              pathname.startsWith("/dashboard/users") ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
            }
          >
            <IconTeam />
            用户管理
          </Link>
        </nav>
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerTitle}>内部运营管理系统</span>
            <span className={styles.headerUser}>
              {user.name}（{user.username}）
            </span>
          </div>
          <LogoutButton />
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
