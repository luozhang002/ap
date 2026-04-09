import { redirect } from "next/navigation";
import { getOmsUser } from "@/lib/session";
import { LogoutButton } from "./LogoutButton";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const user = await getOmsUser();
  if (!user) redirect("/login");

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <p className={styles.brandTitle}>OMS · 内部运营管理系统</p>
          <p className={styles.brandSub}>
            {user.name}（{user.username}）· 管理员
          </p>
        </div>
        <LogoutButton />
      </header>
      <main className={styles.main}>
        <section className={styles.hero}>
          <h2>工作台</h2>
          <p>
            后续可在此接入客户导入、账号权限、审计日志等模块。当前为登录态占位页，已校验管理员角色与 JWT。
          </p>
          <div className={styles.grid}>
            <div className={styles.tile}>
              <h3>客户数据导入</h3>
              <p>批量导入、校验与回滚策略（规划中）</p>
            </div>
            <div className={styles.tile}>
              <h3>账号与权限</h3>
              <p>RBAC、角色模板与审计（规划中）</p>
            </div>
            <div className={styles.tile}>
              <h3>风控与指标</h3>
              <p>AI 辅助风控与运营看板（规划中）</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
