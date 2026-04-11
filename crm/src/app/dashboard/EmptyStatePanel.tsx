import styles from "./page.module.css";

function IconSearchEmpty({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="26" cy="26" r="14" stroke="currentColor" strokeWidth="2.5" opacity="0.35" />
      <path
        d="M36 36l14 14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M22 22l8 8M30 22l-8 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

function IconInboxEmpty({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M12 24h40v28H12V24z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.4"
      />
      <path d="M12 24l20 14 20-14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" opacity="0.45" />
      <path
        d="M24 40h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
}

type Variant = "searchNoMatch" | "noEnterprises";

export function EmptyStatePanel({ variant }: { variant: Variant }) {
  if (variant === "searchNoMatch") {
    return (
      <div className={`${styles.emptyPanel} ${styles.emptyPanelSearch}`} role="status">
        <div className={styles.emptyIconWrap}>
          <IconSearchEmpty className={styles.emptySvg} />
        </div>
        <p className={styles.emptyTitle}>未找到相关企业</p>
        <p className={styles.emptyDesc}>可缩短企业名称、只填「市」其中一项，或稍后再试</p>
      </div>
    );
  }

  return (
    <div className={`${styles.emptyPanel} ${styles.emptyPanelInbox}`} role="status">
      <div className={styles.emptyIconWrap}>
        <IconInboxEmpty className={styles.emptySvg} />
      </div>
      <p className={styles.emptyTitle}>暂无负责企业</p>
      <p className={styles.emptyDesc}>当前账号在 OMS 中暂无匹配的客户经理数据</p>
    </div>
  );
}
