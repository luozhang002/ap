"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./UsersManagement.module.css";

type Role = "ADMIN" | "EMPLOYEE";

export type UserRow = {
  id: number;
  username: string;
  name: string;
  role: Role;
};

type Toast = { type: "success" | "error"; text: string };

export function UsersManagement({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [active, setActive] = useState<UserRow | null>(null);

  const [addUsername, setAddUsername] = useState("");
  const [addName, setAddName] = useState("");
  const [addPassword, setAddPassword] = useState("");

  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirm, setEditConfirm] = useState("");

  const showError = (text: string) => setToast({ type: "error", text });
  const showSuccess = (text: string) => setToast({ type: "success", text });

  useEffect(() => {
    if (!toast || toast.type !== "success") return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: typeof data.error === "string" ? data.error : "加载失败",
        });
        return;
      }
      setUsers(data.users ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canManageRow = (row: UserRow) =>
    row.role === "EMPLOYEE" || row.id === currentUserId;

  const openEdit = (row: UserRow) => {
    setActive(row);
    setEditName(row.name);
    setEditPassword("");
    setEditConfirm("");
    setEditOpen(true);
  };

  const closeAdd = () => {
    setAddOpen(false);
    setAddUsername("");
    setAddName("");
    setAddPassword("");
  };

  const closeEdit = () => {
    setEditOpen(false);
    setActive(null);
    setEditPassword("");
    setEditConfirm("");
  };

  const submitAdd = async () => {
    const username = addUsername.trim();
    const name = addName.trim();
    const password = addPassword;
    if (!username || !name || !password) {
      showError("请填写用户名、姓名和初始密码");
      return;
    }
    if (password.length < 6) {
      showError("初始密码至少 6 位");
      return;
    }
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, name, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(typeof data.error === "string" ? data.error : "创建失败");
      return;
    }
    showSuccess("已添加普通用户");
    closeAdd();
    load();
  };

  const submitEdit = async () => {
    if (!active) return;
    const name = editName.trim();
    const password = editPassword.trim();
    const confirm = editConfirm.trim();

    if (!name) {
      showError("请输入姓名");
      return;
    }

    const body: { name: string; password?: string } = { name };

    if (password || confirm) {
      if (password.length < 6) {
        showError("新密码至少 6 位");
        return;
      }
      if (password !== confirm) {
        showError("两次输入的密码不一致");
        return;
      }
      body.password = password;
    }

    const res = await fetch(`/api/users/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(typeof data.error === "string" ? data.error : "保存失败");
      return;
    }
    showSuccess("已保存");
    closeEdit();
    load();
  };

  return (
    <div>
      {toast?.type === "error" ? (
        <div className={styles.bannerError} role="alert">
          {toast.text}
        </div>
      ) : null}
      {toast?.type === "success" ? (
        <div className={styles.bannerSuccess} role="status">
          {toast.text}
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <h1 className={styles.title}>用户管理</h1>
        <button type="button" className={styles.btnPrimary} onClick={() => setAddOpen(true)}>
          添加普通用户
        </button>
      </div>
      <p className={styles.hint}>
        可添加 CRM 使用的普通员工账号；点「修改」可同时调整姓名与密码（密码留空则不改），不能修改其他管理员。
      </p>

      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.loadingRow}>加载中…</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>用户名</th>
                <th>姓名</th>
                <th>角色</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id}>
                  <td>{row.username}</td>
                  <td>{row.name}</td>
                  <td>
                    {row.role === "ADMIN" ? (
                      <span className={styles.tagAdmin}>管理员</span>
                    ) : (
                      <span className={styles.tagEmp}>普通员工</span>
                    )}
                  </td>
                  <td>
                    {canManageRow(row) ? (
                      <button type="button" className={styles.btnLink} onClick={() => openEdit(row)}>
                        修改
                      </button>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {addOpen ? (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={closeAdd}
          onKeyDown={(e) => e.key === "Escape" && closeAdd()}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal
            aria-labelledby="add-user-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-user-title" className={styles.modalTitle}>
              添加普通用户
            </h2>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="add-username">
                登录用户名
              </label>
              <input
                id="add-username"
                className={styles.input}
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                autoComplete="off"
                placeholder="英文或数字，用于登录"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="add-name">
                姓名
              </label>
              <input
                id="add-name"
                className={styles.input}
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="显示名称"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="add-password">
                初始密码
              </label>
              <input
                id="add-password"
                className={styles.input}
                type="password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="至少 6 位"
              />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={closeAdd}>
                取消
              </button>
              <button type="button" className={styles.btnPrimary} onClick={submitAdd}>
                创建
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen && active ? (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={closeEdit}
          onKeyDown={(e) => e.key === "Escape" && closeEdit()}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal
            aria-labelledby="edit-user-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-user-title" className={styles.modalTitle}>
              修改 · {active.username}
            </h2>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="edit-name">
                姓名
              </label>
              <input
                id="edit-name"
                className={styles.input}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="显示名称"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="edit-password">
                新密码
              </label>
              <input
                id="edit-password"
                className={styles.input}
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="至少 6 位"
              />
              <p className={styles.fieldHint}>不修改密码请留空</p>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="edit-confirm">
                确认新密码
              </label>
              <input
                id="edit-confirm"
                className={styles.input}
                type="password"
                value={editConfirm}
                onChange={(e) => setEditConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="再次输入新密码"
              />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={closeEdit}>
                取消
              </button>
              <button type="button" className={styles.btnPrimary} onClick={submitEdit}>
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
