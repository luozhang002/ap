"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./LogoutButton.module.css";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" className={styles.btn} disabled={loading} onClick={onLogout}>
      {loading ? "退出中…" : "退出"}
    </button>
  );
}
