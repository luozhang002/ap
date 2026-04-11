import { redirect } from "next/navigation";
import {
  MANAGER_ENTERPRISES_DEFAULT_LIMIT,
  queryManagerEnterprises,
} from "@/lib/crm-visited-enterprises";
import { getCrmUser } from "@/lib/session";
import { EmptyStatePanel } from "./EmptyStatePanel";
import MyEnterprisesSection from "./MyEnterprisesSection";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const user = await getCrmUser();
  if (!user) redirect("/login");

  const initialPage = await queryManagerEnterprises(user.name, {
    limit: MANAGER_ENTERPRISES_DEFAULT_LIMIT,
  });

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <p className={styles.brandSub}>
            {user.name}（{user.username}）的客户
          </p>
        </div>
      </header>
      <main className={styles.main}>
        <section className={`${styles.hero} ${styles.heroVisited}`}>
          {initialPage.items.length === 0 && !initialPage.hasMore ? (
            <EmptyStatePanel variant="noEnterprises" />
          ) : (
            <MyEnterprisesSection initialPage={initialPage} />
          )}
        </section>
      </main>
    </div>
  );
}
