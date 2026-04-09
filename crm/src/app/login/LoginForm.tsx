"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./LoginForm.module.css";

function UserIcon() {
  return (
    <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!username || !password) {
      setError("请输入用户名和密码");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "登录失败");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="crm-username">
          用户名
        </label>
        <div className={styles.inputRow}>
          <UserIcon />
          <input
            id="crm-username"
            name="username"
            className={styles.input}
            type="text"
            autoComplete="username"
            placeholder="员工账号"
            inputMode="text"
            disabled={loading}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="crm-password">
          密码
        </label>
        <div className={styles.inputRow}>
          <LockIcon />
          <input
            id="crm-password"
            name="password"
            className={styles.input}
            type="password"
            autoComplete="current-password"
            placeholder="密码"
            disabled={loading}
          />
        </div>
      </div>

      <button type="submit" className={styles.submit} disabled={loading}>
        {loading ? "登录中…" : (
          <>
            <MapPinIcon />
            进入 CRM
          </>
        )}
      </button>
    </form>
  );
}
