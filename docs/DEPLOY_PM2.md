# 部署指南：PM2（从零到上线）

面向第一次部署的同学：按顺序做即可。假设你有一台 **Linux 服务器**（例如腾讯云 CentOS / Ubuntu），能通过 **SSH** 登录，并且 **MySQL 已安装**、监听 **3306**。

---

## 一、这套系统在服务器上要跑什么？

| 名称 | 说明 | 默认端口 |
|------|------|----------|
| **OMS** | 管理端 Next.js 应用 | **3000** |
| **CRM** | 客户经理端 Next.js 应用 | **3001** |
| **MySQL** | 数据库（与 OMS/CRM **共用同一个库**） | **3306** |

两个应用都用 **Prisma** 连同一个库（例如库名 `ap`），且 **`JWT_SECRET` 两边必须完全一致**，否则登录态无法共用。

---

## 二、你需要提前准备什么？

1. **服务器公网 IP**（或已解析的域名）。
2. **SSH 登录方式**：用户名 + 密码，或 **密钥**（更推荐密钥）。
3. **MySQL**：能创建数据库、有账号密码（示例里用 `root`，生产建议单独建业务账号）。
4. **代码**：仓库克隆到服务器，或从本机 `scp` / `rsync` 上传。

下面命令里 **路径用 `/opt/ap` 举例**，你可改成自己的目录。

---

## 三、登录服务器并安装基础工具

用终端（Mac/Linux 用自带终端，Windows 可用 PowerShell 或安装 OpenSSH）：

```bash
ssh 你的用户名@服务器IP
```

### 1. 安装 Git（若还没有）

**CentOS 7：**

```bash
sudo yum install -y git
```

**Ubuntu / Debian：**

```bash
sudo apt update
sudo apt install -y git
```

### 2. 安装 Node.js（推荐使用 nvm）

许多系统自带的 Node 版本过旧，建议用 **nvm** 管理 Node 版本。国内网络可使用 Gitee 上的 [nvm-cn](https://gitee.com/RubyMetric/nvm-cn) 安装脚本（与官方 nvm 用法一致）：

```bash
curl -o- https://gitee.com/RubyMetric/nvm-cn/raw/main/install.sh | bash
source ~/.bashrc
```

若你使用 **zsh**，且安装脚本提示写入的是 `~/.zshrc`，请改为 `source ~/.zshrc`，或 **重新打开一个终端窗口**。

**版本怎么选：**

- **与本地开发一致（推荐减少「我本地能跑」差异）**：若你本机是 **v23.11.0**，服务器也固定同一版本即可：

```bash
nvm install 23.11.0
nvm use 23.11.0
nvm alias default 23.11.0
node -v
npm -v
```

应看到 `v23.11.0`。

- **更看重长期维护**：可选用 **Node 20** 或 **Node 22** 等 **LTS**（长期支持）版本，例如 `nvm install 22`、`nvm install 20`。Node **23** 属于当前特性版本，不是 LTS；小团队与本地对齐用 **23.11.0** 完全可行，只要后续升级 Node 时在本地与服务器一起测即可。

### 3. 全局安装 PM2

```bash
npm install -g pm2
pm2 -v
```

---

## 四、把代码放到服务器上

### 方式 A：Git 克隆（推荐）

```bash
sudo mkdir -p /opt/ap
sudo chown "$USER":"$USER" /opt/ap
cd /opt/ap
git clone <你的仓库地址> .
```

若仓库在子目录，保证 **`oms/`、`crm/`** 与根目录 **`ecosystem.config.cjs`** 在一起即可。

### 方式 B：本机打包上传

在本机项目根目录打包（排除 `node_modules` 可减小体积），上传到服务器 `/opt/ap` 后解压。

---

## 五、MySQL：创建数据库

登录 MySQL（密码按你的实际填写）：

```bash
mysql -u root -p -h 127.0.0.1
```

在 MySQL 里执行：

```sql
CREATE DATABASE IF NOT EXISTS ap
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
EXIT;
```

---

## 六、配置环境变量

每个应用各自一份配置文件。生产环境一般用 **`.env`** 或 **`.env.production`**（Next.js 会加载），放在 **`oms/`** 与 **`crm/`** 目录下。

### 1. OMS：`/opt/ap/oms/.env`

可复制示例再改：

```bash
cd /opt/ap/oms
cp .env.example .env
nano .env
```

至少包含（把密码、密钥改成你自己的）：

```env
DATABASE_URL="mysql://root:你的数据库密码@127.0.0.1:3306/ap"
JWT_SECRET="一段足够长的随机字符串"
```

生成随机 `JWT_SECRET` 示例：

```bash
openssl rand -base64 32
```

### 2. CRM：`/opt/ap/crm/.env`

```bash
cd /opt/ap/crm
cp .env.example .env
nano .env
```

- **`DATABASE_URL`**：与 OMS **相同**（同一库、同一账号）。
- **`JWT_SECRET`**：与 OMS **完全相同**。
- **陌拜地图**（若使用）：填写高德开放平台申请的：

```env
NEXT_PUBLIC_AMAP_KEY="你的 Key"
NEXT_PUBLIC_AMAP_SECURITY_JS_CODE="你的安全密钥"
```

改完保存。若之后修改了 `NEXT_PUBLIC_*`，需要 **重新执行构建**（见下文）。

### 3. 文件权限（可选）

```bash
chmod 600 /opt/ap/oms/.env /opt/ap/crm/.env
```

---

## 七、安装依赖、同步数据库表结构、构建

### 1. 安装依赖

```bash
cd /opt/ap/oms && npm ci
cd /opt/ap/crm && npm ci
```

若没有 `package-lock.json`，改用 `npm install`。

### 2. 用 Prisma 把表结构推到 MySQL（只需做一次，或 schema 变更后）

**只在其中一个项目执行即可**（建议 OMS）：

```bash
cd /opt/ap/oms
npx prisma db push
```

若需要种子数据（按项目是否提供）：

```bash
npm run db:seed
```

### 3. 生产构建

```bash
cd /opt/ap/oms && npm run build
cd /opt/ap/crm && npm run build
```

构建时间较长属正常现象。

---

## 八、用 PM2 启动两个应用

项目根目录已有 **`ecosystem.config.cjs`**，会同时启动 **OMS（3000）** 和 **CRM（3001）**。

```bash
cd /opt/ap
pm2 start ecosystem.config.cjs
pm2 status
```

查看日志：

```bash
pm2 logs
```

按 `Ctrl+C` 退出日志跟随（不会停止应用）。

---

## 九、开机自动启动 PM2

```bash
pm2 save
pm2 startup
```

终端会打印 **一行以 `sudo` 开头的命令**，**整行复制执行**（每台机器路径不同，不要抄网上的旧示例）。执行后再：

```bash
pm2 save
```

重启服务器后执行 `pm2 status`，应仍能看到 `ap-oms`、`ap-crm`。

---

## 十、从浏览器访问

- OMS：`http://服务器公网IP:3000`
- CRM：`http://服务器公网IP:3001`

若打不开，请检查：

1. **腾讯云（或其它云）安全组**：是否放行 **入站** TCP **3000**、**3001**（若只用 Nginx 反代则放行 80/443）。
2. 服务器本机防火墙（如 `firewalld`、`ufw`）是否放行对应端口。

---

## 十一、（推荐）用 Nginx 做反向代理与 HTTPS

对外只暴露 **80/443**，由 Nginx 转发到本机 3000/3001，并配置 SSL 证书。具体配置因域名而异，可让运维或按云厂商文档操作；**PM2 仍负责跑 Node 进程**，Nginx 只负责入口。

---

## 十二、以后如何更新版本？

典型流程：

```bash
cd /opt/ap
git pull

# 若数据库模型有变更，在 oms 执行一次：
cd oms && npx prisma db push && cd ..

cd oms && npm ci && npm run build
cd ../crm && npm ci && npm run build

cd /opt/ap
pm2 restart ecosystem.config.cjs
```

若只改了 CRM 的高德 `NEXT_PUBLIC_*`，必须在 **`crm` 目录重新 `npm run build`** 后再 `pm2 restart`。

---

## 十三、常用 PM2 命令

| 操作 | 命令 |
|------|------|
| 查看列表 | `pm2 status` |
| 看日志 | `pm2 logs` |
| 重启 | `pm2 restart ecosystem.config.cjs` |
| 停止 | `pm2 stop ap-oms` / `pm2 stop ap-crm` |
| 删除进程 | `pm2 delete ap-oms` |

---

## 十四、常见问题

### 1. 页面能开，但登录异常、两边登录态不一致

检查 **`JWT_SECRET`** 在 `oms/.env` 与 `crm/.env` 是否 **完全一致**（无多余空格、引号一致）。

### 2. 数据库连接失败

检查 `DATABASE_URL` 里主机是否为 **`127.0.0.1`** 或 **`localhost`**、端口 **3306**、库名 **ap**、用户名密码是否正确；MySQL 是否允许本地连接。

### 3. `npm run build` 内存不足

小内存机器可临时加 swap，或升级实例规格。

### 4. 端口被占用

```bash
# 示例：看谁占用了 3000
sudo ss -tlnp | grep 3000
```

关闭占用进程或修改 `package.json` 里端口（需同步改防火墙与访问地址）。

### 5. CentOS 7 上执行 `node -v` 报 `GLIBC_2.27` / `GLIBCXX_3.4.21` / `CXXABI_1.3.9` 等

**原因：** CentOS 7 自带的 **glibc 版本较旧（约 2.17）**。通过 nvm 下载的 **Node 官方预编译包**（如 Node 18+、20、23）是针对 **较新 glibc** 的系统打的，在 CentOS 7 上运行就会报上述符号找不到。

**可行做法（按推荐顺序）：**

1. **换系统镜像（最省心）**  
   新机器或重装时改用 **Rocky Linux 8/9、AlmaLinux 8/9、Ubuntu 22.04** 等，再按本文安装 nvm / Node，一般不再出现此类错误。

2. **继续用 CentOS 7 时：用 Docker 跑 Node（推荐）**  
   宿主机只装 Docker，应用在 **镜像内** 使用较新的 Linux 与 Node，不依赖 CentOS 7 的 glibc。见 **`DEPLOY_DOCKER.md`**。

3. **继续用 CentOS 7 + 本机 PM2：从源码编译 Node（耗时长）**  
   用 nvm **源码安装**，让 Node 在 **本机 glibc 2.17** 上编译链接（需编译工具链）：

   ```bash
   sudo yum groupinstall -y "Development Tools"
   sudo yum install -y python3
   nvm install -s 23.11.0
   ```

   `-s` 表示从源码编译，可能要 **几十分钟**。若编译失败，多半是缺少依赖，按报错补装 `openssl-devel` 等。

4. **不推荐：** 手动替换系统 `libc` / 强行拷新 `glibc`，极易把系统弄崩。

---

## 十五、安全建议（必读）

1. **不要把数据库 root 密码、JWT、SSH 密码写进公开文档或截图。**
2. 生产环境建议 **SSH 密钥登录**，关闭密码登录。
3. MySQL **不要对公网开放 3306**，仅本机或内网访问。
4. 定期备份数据库。

按本文操作，你应能独立完成 **PM2 + 双应用** 部署；若你改用 Docker，请参阅同目录下的 **`DEPLOY_DOCKER.md`**。
