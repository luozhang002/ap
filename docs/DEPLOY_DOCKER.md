# 部署指南：Docker（从零到上线）

面向第一次用 Docker 的同学。本文使用仓库里的 **`docker-compose.yml`**，一次性拉起 **OMS** 与 **CRM** 两个容器；**MySQL 默认假设装在宿主机上**（与多数「数据库已在 3306」的场景一致）。若你希望 MySQL 也放进 Compose，见文末「可选扩展」。

---

## 一、你将得到什么？

| 容器 | 对外端口 | 说明 |
|------|----------|------|
| **oms** | **3000** | 管理端 |
| **crm** | **3001** | 客户经理端 |

数据库：**与 PM2 方案相同**，仍是 **同一个 MySQL 库**（如 `ap`），**`JWT_SECRET` 在 OMS/CRM 环境变量中必须一致**。

---

## 二、服务器要装什么？

1. **Docker Engine**（20.10+ 较稳妥，便于 `host-gateway`）。
2. **Docker Compose**（Docker 新版本自带 `docker compose` 子命令）。

**Ubuntu 示例（官方文档为准，此处仅作流程参考）：**

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
# 以下一行需按你系统版本换源，详见 Docker 官方文档
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"
```

执行 `usermod` 后 **重新登录 SSH**，再试：

```bash
docker run --rm hello-world
docker compose version
```

**CentOS 7**：可参考 Docker 官方文档用仓库安装；若内核过旧，长期建议升级到更新系统。

---

## 三、代码放到服务器

与 PM2 相同：把本仓库放到例如 **`/opt/ap`**，保证包含：

- `oms/`（含 `Dockerfile`）
- `crm/`（含 `Dockerfile`）
- 根目录 `docker-compose.yml`、`docker-compose.env.example`

```bash
cd /opt/ap
git clone <你的仓库> .
```

---

## 四、宿主机 MySQL 准备

### 1. 创建数据库（若尚未创建）

在 **宿主机** 上：

```bash
mysql -u root -p -h 127.0.0.1
```

```sql
CREATE DATABASE IF NOT EXISTS ap
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
EXIT;
```

### 2. 容器如何访问「宿主机」上的 MySQL？

Linux 上容器里用主机名 **`host.docker.internal`** 访问宿主机，需要 Compose 里配置（**本仓库已写好**）：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

因此 **`DATABASE_URL` 里主机名写 `host.docker.internal`**，**不要写 `127.0.0.1`**（在容器内 `127.0.0.1` 是容器自己，不是宿主机）。

示例：

```env
DATABASE_URL="mysql://root:你的密码@host.docker.internal:3306/ap"
```

### 3. MySQL 监听地址

确保 MySQL 对来自 Docker 网桥的连接开放。常见做法是让 **`mysqld` 监听 `0.0.0.0:3306`** 或至少包含 Docker 网关（不同环境略有差异）。若连接被拒绝，需在 **`my.cnf`** 中检查 `bind-address`，并确认 `mysql.user` 中允许从对应来源访问（简化时可对 `root`/`%` 做测试，生产请收紧权限）。

---

## 五、配置环境变量（Compose 用）

在 **仓库根目录**（与 `docker-compose.yml` 同级）：

```bash
cd /opt/ap
cp docker-compose.env.example .env
nano .env
```

按说明填写：

| 变量 | 说明 |
|------|------|
| **DATABASE_URL** | 主机用 **`host.docker.internal`**，库名 **`ap`** |
| **JWT_SECRET** | OMS/CRM 共用，与 PM2 部署时要求相同 |
| **NEXT_PUBLIC_AMAP_KEY** | CRM 陌拜地图（高德 Web JS Key） |
| **NEXT_PUBLIC_AMAP_SECURITY_JS_CODE** | 高德安全密钥，与 Key 同一应用 |

**注意：** CRM 的 `NEXT_PUBLIC_*` 会在 **构建镜像时** 打进前端，改这些变量后需要 **重新构建 CRM 镜像**：

```bash
docker compose build crm --no-cache
docker compose up -d
```

---

## 六、构建并启动

```bash
cd /opt/ap
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
docker compose logs -f
```

按 `Ctrl+C` 退出日志。

浏览器访问：

- OMS：`http://服务器IP:3000`
- CRM：`http://服务器IP:3001`

---

## 七、首次同步数据库表结构（Prisma）

镜像跑起来后，在 **oms 容器** 里执行一次 `db push`（或 schema 变更后再执行）：

```bash
cd /opt/ap
docker compose run --rm oms npx prisma db push
```

该命令会使用 Compose 里为 **oms** 注入的 **`DATABASE_URL`**，请确保已指向 **`host.docker.internal:3306`**。

若项目提供 seed，可在宿主机有 Node 时在源码目录执行；或临时用 oms 容器执行（需镜像内带 `tsx` 等 dev 依赖时才能用，**以你项目 `package.json` 为准**）。

---

## 八、防火墙与安全组

- **云安全组**：放行 **3000**、**3001**（若前面加 Nginx，则主要放行 **80/443**）。
- **不要**对公网放行 **3306**。

---

## 九、常用维护命令

| 场景 | 命令 |
|------|------|
| 停止 | `docker compose down` |
| 重启 | `docker compose up -d` |
| 看日志 | `docker compose logs -f oms` / `crm` |
| 更新代码后重建 | `git pull && docker compose up -d --build` |

---

## 十、与 PM2 方案怎么选？

| | PM2 | Docker |
|---|-----|--------|
| 学习成本 | 较低，直接跑 Node | 需会基础 Docker/Compose |
| 环境一致性 | 依赖服务器全局 Node | 镜像内版本固定，易复现 |
| 资源占用 | 相对轻 | 略多一层隔离 |
| MySQL | 本机 `127.0.0.1` 即可 | 容器内需 `host.docker.internal` 或同网络服务名 |

---

## 十一、故障排查

### 1. 容器内连不上 MySQL

- `DATABASE_URL` 主机是否为 **`host.docker.internal`**。
- 宿主机 MySQL 是否监听在可被 Docker 访问的地址。
- 账号是否允许从 Docker 网段连接。

### 2. CRM 地图不显示 / 控制台报高德错误

- 检查构建时是否传入 **`NEXT_PUBLIC_AMAP_KEY`** 与 **`NEXT_PUBLIC_AMAP_SECURITY_JS_CODE`**。
- 修改后执行 **`docker compose build crm --no-cache`** 再 **`up -d`**。

### 3. `host.docker.internal` 不生效

- 升级 Docker 到较新版本，并确认 `docker-compose.yml` 含 **`host-gateway`** 的 `extra_hosts`。
- 若仍不行，可查询当前 Docker 网桥 IP，在 `DATABASE_URL` 里临时写该网关 IP（不如 host-gateway 优雅，仅作排查）。

---

## 十二、可选扩展：MySQL 也放进 Compose

若你希望 **一键拉起数据库 + 应用**，可自行在 `docker-compose.yml` 增加 `mysql` 服务，并将 `DATABASE_URL` 改为：

```env
DATABASE_URL="mysql://root:密码@mysql:3306/ap"
```

同时去掉 `host.docker.internal` 相关配置；数据卷用 **volume** 持久化。**生产环境**还需考虑备份、密码管理与资源限制。当前仓库默认 **不包含** MySQL 服务，以便与你「已有 3306 数据库」的现状一致。

---

## 十三、安全建议

1. **`.env` 不要提交到 Git**（确认已在 `.gitignore` 中）。
2. 生产使用强密码、限制 SSH、数据库不暴露公网。
3. 对外服务尽量走 **HTTPS**（Nginx + 证书）。

更基础的「不用 Docker、直接 PM2」的步骤见 **`DEPLOY_PM2.md`**。
