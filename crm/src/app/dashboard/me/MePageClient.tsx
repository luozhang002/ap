"use client";

import { Button } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./page.module.css";

export function MePageClient() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("请填写完整");
      return;
    }
    if (newPassword.length < 6) {
      setError("新密码至少 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "修改失败");
        return;
      }
      setSuccess("密码已更新，请牢记新密码");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    setLogoutLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <>
      <h2 className={styles.sectionTitle}>修改登录密码</h2>
      <form className={styles.formCard} onSubmit={submit} noValidate>
        {error ? (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className={styles.successBanner} role="status">
            {success}
          </div>
        ) : null}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="me-cur-pw">
            当前密码
          </label>
          <input
            id="me-cur-pw"
            className={styles.input}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="请输入当前密码"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="me-new-pw">
            新密码
          </label>
          <input
            id="me-new-pw"
            className={styles.input}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="至少 6 位"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="me-confirm-pw">
            确认新密码
          </label>
          <input
            id="me-confirm-pw"
            className={styles.input}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="再次输入新密码"
          />
        </div>
        <p className={styles.hint}>修改成功后需使用新密码登录 CRM。</p>
        <div className={styles.submitRow}>
          <Button type="primary" htmlType="submit" loading={loading} block size="large">
            保存新密码
          </Button>
        </div>
      </form>

      <div className={styles.logoutRow}>
        <Button danger block size="large" icon={<LogoutOutlined />} loading={logoutLoading} onClick={onLogout}>
          退出登录
        </Button>
      </div>
    </>
  );
}
