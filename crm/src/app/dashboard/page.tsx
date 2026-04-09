import { AimOutlined, EnvironmentOutlined, TeamOutlined } from "@ant-design/icons";
import { redirect } from "next/navigation";
import { getCrmUser } from "@/lib/session";
import { LogoutButton } from "./LogoutButton";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const user = await getCrmUser();
  if (!user) redirect("/login");

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <p className={styles.brandTitle}>CRM · 客户与地图</p>
          <p className={styles.brandSub}>
            {user.name}（{user.username}）· 外勤员工
          </p>
        </div>
        <LogoutButton />
      </header>
      <main className={styles.main}>
        <section className={styles.hero}>
          <h2>今日概览</h2>
          <p>
            后续可在此接入客户列表、拜访地图、路线规划与签到。当前页面用于验证普通员工登录态与移动端布局。
          </p>
          <div className={styles.grid}>
            <div className={styles.tile}>
              <div className={styles.icon} aria-hidden>
                <TeamOutlined />
              </div>
              <div>
                <h3>客户跟进</h3>
                <p>线索、商机与联系人（规划中）</p>
              </div>
            </div>
            <div className={styles.tile}>
              <div className={styles.icon} aria-hidden>
                <EnvironmentOutlined />
              </div>
              <div>
                <h3>地图拜访</h3>
                <p>附近客户、路线与签到（规划中）</p>
              </div>
            </div>
            <div className={styles.tile}>
              <div className={styles.icon} aria-hidden>
                <AimOutlined />
              </div>
              <div>
                <h3>任务与日程</h3>
                <p>待办、提醒与协同（规划中）</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
