/**
 * PM2：同时托管 OMS（3000）与 CRM（3001）。
 *
 * 前置：oms/、crm/ 已分别配置 .env 或 .env.production，且已执行 npm ci && npm run build。
 * 用法（在仓库根目录）：
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup   # 开机自启（按 pm2 提示执行一条 sudo 命令）
 */
const path = require("path");

const root = __dirname;

module.exports = {
  apps: [
    {
      name: "ap-oms",
      cwd: path.join(root, "oms"),
      script: "npm",
      args: "run start",
      env: { NODE_ENV: "production" },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "ap-crm",
      cwd: path.join(root, "crm"),
      script: "npm",
      args: "run start",
      env: { NODE_ENV: "production" },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
  ],
};
