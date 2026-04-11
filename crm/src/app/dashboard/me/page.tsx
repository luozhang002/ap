import { redirect } from "next/navigation";
import { getManagerVisitStats } from "@/lib/crm-visited-enterprises";
import { getCrmUser } from "@/lib/session";
import { MePageClient } from "./MePageClient";
import styles from "./page.module.css";

export default async function MePage() {
  const user = await getCrmUser();
  if (!user) redirect("/login");

  const stats = await getManagerVisitStats(user.name);

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <h1 className={styles.title}>我的</h1>
          <p className={styles.sub}>账号、拜访概况与安全</p>
        </div>
      </header>
      <main className={styles.main}>
        <section className={styles.profileCard}>
          <p className={styles.profileName}>{user.name}</p>
          <p className={styles.profileMeta}>登录名 · {user.username}</p>
        </section>

        <section className={styles.statsSection} aria-label="拜访统计">
          <h2 className={styles.statsHeading}>拜访概况</h2>
          <p className={styles.statsScope}>
            与首页负责企业列表一致：按 OMS 中「客户经理」与您的登录姓名匹配。
          </p>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{stats.total}</p>
              <p className={styles.statLabel}>负责客户（家）</p>
            </div>
            <div className={`${styles.statCard} ${styles.statCardVisited}`}>
              <p className={styles.statValue}>{stats.visited}</p>
              <p className={styles.statLabel}>累计已拜访</p>
            </div>
            <div className={`${styles.statCard} ${styles.statCardPending}`}>
              <p className={styles.statValue}>{stats.unvisited}</p>
              <p className={styles.statLabel}>待拜访</p>
            </div>
          </div>
        </section>

        <MePageClient />
      </main>
    </div>
  );
}
