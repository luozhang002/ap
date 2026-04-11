import { redirect } from "next/navigation";
import { getEnterprisesForManager } from "@/lib/crm-visited-enterprises";
import { getCrmUser } from "@/lib/session";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const user = await getCrmUser();
  if (!user) redirect("/login");

  const { items } = await getEnterprisesForManager(user.name);

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <p className={styles.brandTitle}>我的企业</p>
          <p className={styles.brandSub}>
            {user.name}（{user.username}）· 外勤员工
          </p>
        </div>
      </header>
      <main className={styles.main}>
        <section className={`${styles.hero} ${styles.heroVisited}`}>
          <h2>我的企业</h2>
          <p className={styles.sectionHint}>
            根据您账号「姓名」与 OMS 导入「分中心负责人」（客户经理）匹配；含已拜访与未拜访，卡片上可区分状态。
          </p>
          {items.length === 0 ? (
            <p className={styles.emptyHint}>
              暂无负责企业。请确认用户「姓名」与 Excel「分中心负责人」一致（含空格、全半角须一致）。
            </p>
          ) : (
            <ul className={styles.cardList} aria-label="负责企业列表">
              {items.map((e) => (
                <li key={e.id} className={styles.visitCard}>
                  <div className={styles.visitCardTop}>
                    <span className={styles.visitCardName}>{e.customerName?.trim() || `企业 #${e.id}`}</span>
                    <div className={styles.badges}>
                      <span className={e.isVisited ? styles.statusVisited : styles.statusPending}>
                        {e.isVisited ? "已拜访" : "未拜访"}
                      </span>
                      <span className={styles.kindBadge}>{e.sheetKindLabel}</span>
                    </div>
                  </div>
                  {(e.province || e.city || e.district) && (
                    <p className={styles.visitCardLine}>
                      {[e.province, e.city, e.district].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {e.issuedAddress?.trim() && (
                    <p className={styles.visitCardAddr} title={e.issuedAddress}>
                      {e.issuedAddress}
                    </p>
                  )}
                  <dl className={styles.visitMeta}>
                    {e.actualVisitTime && (
                      <div className={styles.metaRow}>
                        <dt>实际上门</dt>
                        <dd>{e.actualVisitTime}</dd>
                      </div>
                    )}
                    {e.lastVisitTime && (
                      <div className={styles.metaRow}>
                        <dt>最近上门</dt>
                        <dd>{e.lastVisitTime}</dd>
                      </div>
                    )}
                    {e.contactPhone?.trim() && (
                      <div className={styles.metaRow}>
                        <dt>联系电话</dt>
                        <dd>{e.contactPhone}</dd>
                      </div>
                    )}
                  </dl>
                  {e.visitRemark?.trim() && (
                    <p className={styles.visitRemark} title={e.visitRemark}>
                      {e.visitRemark}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
