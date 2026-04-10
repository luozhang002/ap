"use client";

import { useEffect, useState } from "react";
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

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 无 JS / hydration 未完成时，浏览器会对表单做原生 GET 提交，密码会出现在 URL。加载后清掉查询串。
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("password") || url.searchParams.has("username")) {
        window.history.replaceState({}, "", `${url.pathname}${url.hash}`);
      }
    } catch {
      /* ignore */
    }
  }, []);

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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "登录失败");
        return;
      }
      // 整页跳转，确保 Set-Cookie 已写入后再请求 /dashboard（避免局域网/IP 下客户端导航与 Cookie 竞态）
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误，请检查控制台与 Next dev 是否允许当前访问来源");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} method="post" onSubmit={onSubmit} noValidate>
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="oms-username">
          用户名
        </label>
        <div className={styles.inputRow}>
          <UserIcon />
          <input
            id="oms-username"
            name="username"
            className={styles.input}
            type="text"
            autoComplete="username"
            placeholder="管理员账号"
            disabled={loading}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="oms-password">
          密码
        </label>
        <div className={styles.inputRow}>
          <LockIcon />
          <input
            id="oms-password"
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
        {loading ? "登录中…" : "登录 OMS"}
      </button>
    </form>
  );
}
