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
          <p className={styles.sub}>
            与首页相同：按 OMS「客户经理」（导入「负责人」）与登录姓名匹配 · 红点未拜访 / 蓝点已拜访
          </p>
        </div>
      </header>
      <main className={styles.main}>
        <VisitMapPageClient />
      </main>
    </div>
  );
}
