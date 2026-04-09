import Link from "next/link";
import { redirect } from "next/navigation";
import { getCrmUser } from "@/lib/session";
import { VisitMapPageClient } from "./VisitMapPageClient";
import styles from "./page.module.css";

export default async function VisitMapPage() {
  const user = await getCrmUser();
  if (!user) redirect("/login");

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <h1 className={styles.title}>陌拜地图</h1>
          <p className={styles.sub}>分中心负责人名下客户 · 红点未拜访 / 蓝点已拜访</p>
        </div>
        <Link href="/dashboard" className={styles.backLink}>
          返回首页
        </Link>
      </header>
      <main className={styles.main}>
        <VisitMapPageClient />
      </main>
    </div>
  );
}
