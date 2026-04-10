import { redirect } from "next/navigation";
import { getOmsSession } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import styles from "./page.module.css";

export default async function LoginPage() {
  const s = await getOmsSession();
  if (s) redirect("/dashboard");

  return (
    <div className={styles.shell}>
      <div className={styles.grid} aria-hidden />
      <div className={styles.glow} aria-hidden />
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.badge}>
            <span className={styles.dot} />
            AI · FinTech Ops
          </div>
          <h1 className={styles.title}>OMS 运营中枢</h1>
          <p className={styles.sub}>智能风控与运营数据一体化工作台，仅限管理员访问。</p>
        </div>
        <LoginForm />
        <p className={styles.footer}>演示账号：admin / Admin123456</p>
      </div>
    </div>
  );
}
