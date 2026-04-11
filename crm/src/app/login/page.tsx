import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCrmSession, getCrmUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import styles from "./page.module.css";

export default async function LoginPage() {
  const s = await getCrmSession();
  if (s) {
    const user = await getCrmUser();
    if (user) redirect("/dashboard");
    (await cookies()).delete("crm_token");
  }

  return (
    <div className={styles.shell}>
      <div className={styles.mapLayer} aria-hidden />
      <div className={styles.roads} aria-hidden />
      <div className={styles.pin} aria-hidden />
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.badge}>地图 · 客户 · 跟进</div>
          <h1 className={styles.title}>CRM 移动工作台</h1>
          <p className={styles.sub}>面向外勤与客情的客户关系管理，请使用普通员工账号登录。</p>
        </div>
        <LoginForm />
        <p className={styles.footer}>演示：zhangsan / User123456（或 lisi、wangwu）</p>
      </div>
    </div>
  );
}
