"use client";

import dynamic from "next/dynamic";
import styles from "./page.module.css";

const CrmVisitMap = dynamic(() => import("@/components/CrmVisitMap"), {
  ssr: false,
  loading: () => <VisitMapPanelSkeleton />,
});

function VisitMapPanelSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden>
      <div className={styles.skeletonToolbar} />
      <div className={styles.skeletonMap} />
    </div>
  );
}

export function VisitMapPageClient() {
  return <CrmVisitMap />;
}
