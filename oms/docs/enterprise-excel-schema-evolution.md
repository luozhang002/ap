# 企业管理 Excel 模板与库表演进说明

本文说明 **OMS 企业管理 Excel 导入** 与 **MySQL `enterprise_records` 表** 的对应关系，并沉淀：

- 本次（名单退回相关字段）迁移做了什么；
- 以后 **新增 / 重命名 / 删除** 模板列时，如何 **兼容旧模板上传**，并 **同步改代码**；
- 注意事项与推荐做法，便于后续评审、对比方案时引用。

适用范围：**`ap/oms`**（导入与后台）、**`ap/crm`**（与 OMS **共用同一 MySQL**，Prisma 模型需一致）。脚本目录 **`ap/script`** 中的字段对比表可用于核对三 Sheet 表头。

---

## 数据安全说明（必读）：会不会删掉库里已有数据？

**按本文档推荐的「演进」方式，正常不会清空或删除已有业务行。**

| 操作 | 对已有 **行数据** 的影响 |
|------|-------------------------|
| **`ALTER TABLE ... ADD COLUMN`（新增可空列）** | **不删行、不改旧列已有值**；新列对历史行一般为 `NULL`，直至重新导入或业务写入。本次名单退回字段即属此类。 |
| **`prisma migrate deploy` / `migrate dev`**（迁移内容仅为上述加列等**非破坏性** DDL） | 与手工执行等价 DDL 一致：**不删表、不截断表**。 |
| **仅改代码**（表头映射、`extraJson`、OMS 展示） | **不涉及**数据库结构时，**不改变**库里已有数据。 |

**会删除或大面积破坏数据的情况（与「本文默认方案」不同，需单独评审）：**

- 迁移 SQL 中含 **`DROP TABLE`**、**`TRUNCATE TABLE`**、**`DELETE` 无 WHERE** 等；
- **`DROP COLUMN`**：整列历史值删除（行仍在，但该列数据永久丢失）；
- 某些 **`ALTER` 改类型/缩短长度**：可能触发隐式转换失败或截断，需在变更前备份与验证；
- 开发环境误用 **`prisma migrate reset`**：会**按 Prisma 流程重建库**，通常等于**清空该库开发数据**（**切勿对生产库使用**）。

**上线前建议：** 打开 `prisma/migrations/.../migration.sql` **通读一遍**；生产环境先备份或至少在维护窗口执行，确认 SQL 仅为 **加列/加索引** 等预期操作。

---

## 本地开发 → 生产上线：操作流程（建议照做）

本节回答：**本地改完 schema / 迁移后，到服务器要怎么更新**，避免漏步骤或顺序错误。

### A. 本地开发阶段（提交代码前）

1. **改模型与业务代码**（与本文其它章节一致）：`oms`、`crm` 的 `schema.prisma` 保持同步；`enterprise-headers.ts`、`enterprise-import.ts`、OMS 页面/API 等按需修改。  
2. **生成迁移**（二选一，团队约定为准）：  
   - **`npx prisma migrate dev --name 简述变更`**（在 **`oms`** 目录执行，且 `DATABASE_URL` 指向**本地/开发库**）：会生成 `prisma/migrations/.../migration.sql` 并应用到该库。  
   - 或手写 `migration.sql` 后，本地用 `db execute` / `migrate dev` 验证。  
3. **提交 Git 时务必包含**：`prisma/migrations/` 下**新增目录**（含 `migration.sql`）、以及 `migration_lock.toml`（若有变更）。**不要只提交 `schema.prisma` 而不提交迁移文件**，否则生产无法复现同一 DDL。  
4. **本地验证**：`npx prisma migrate status` 应为已应用；`npx prisma generate`（OMS、CRM 各一次）；本地跑通导入/页面。  
5. **切勿**对**任何生产连接**执行 `prisma migrate reset`（会重建库，数据风险极高）。

### B. 生产服务器（或发布流水线）

前提：服务器上的 **`DATABASE_URL`** 指向**生产 MySQL**（与本地库分离）。

1. **拉取已合并的代码**（含完整 `prisma/migrations/`）。  
2. **（强烈建议）备份生产库**：至少对将变更的表做快照或 mysqldump，便于误操作回滚。  
3. **执行迁移（只对「同一套」库执行一次）**  
   - OMS 与 CRM **共用同一 MySQL**，**迁移只需在一个能连上该库的环境执行一次**（通常在 **OMS 仓库目录**或统一的数据库 Job）：  

   ```bash
   cd /path/to/oms   # 或 CI 中工作目录指向 oms
   npx prisma migrate deploy
   ```  

   - 成功标志：`migrate deploy` 无报错；`npx prisma migrate status` 显示 **Database schema is up to date**。  
4. **若生产库曾从未用过 Prisma Migrate**（无 `_prisma_migrations` 表，执行 `deploy` 报 P3005 等）：需按 [Prisma 文档「已有数据库接 Migrate」](https://www.prisma.io/docs/guides/migrate/developing-with-prisma-migrate/add-prisma-migrate-to-a-project) 做 **baseline**，或像开发环境一样在**审阅 SQL 后**手动执行 `migration.sql`，再用 `prisma migrate resolve --applied <迁移目录名>` 标记已应用——**须由熟悉库结构的人操作**，避免重复执行 DDL。  
5. **构建并重启应用**  
   - **OMS**：安装依赖 → `npx prisma generate`（若构建脚本未包含）→ `npm run build` → 重启进程（pm2 / systemd / K8s 等）。  
   - **CRM**：同样 **`prisma generate` + build + 重启**（与 OMS **共用库表**，但各自 node 进程需带上**新**的 `@prisma/client`，否则旧 Client 不认新列）。  
6. **验证**：生产上试一次列表/导入关键路径；必要时只看 DB 中 `enterprise_records` 是否已有新列。

### C. 推荐顺序（减少故障窗口）

| 顺序 | 说明 |
|------|------|
| **1. 先执行 `migrate deploy`（或等价 DDL）** | 库先有新列（可空），再上线读写新字段的代码，最稳。 |
| **2. 再发布 OMS / CRM 新版本** | 旧版本代码不访问新列一般仍可跑；新版本才能写读新列。 |
| **若必须先发代码** | 新列须 **可空**，且代码在字段为 `null` 时不能报错；仍建议尽快补迁移。 |

### D. 与「仅改代码、不改库」的区分

- **只改** `enterprise-headers`、页面，**没有**新的 Prisma 字段：服务器只需 **重新部署代码**，**不必** `migrate deploy`。  
- **只要 `schema.prisma` 多了字段且需要落库**：就必须有对应 **迁移** 并在生产执行，否则运行时会与真实表结构不一致。

### E. 多人协作提醒

- **同一迁移目录名全局唯一**，合并分支时注意别重复生成同名迁移。  
- 生产 **`migrate deploy` 只应执行「尚未在 `_prisma_migrations` 里登记」的迁移**，不要手工改已应用过的 SQL 文件内容（应新增新迁移修正）。

---

## 一、架构要点（先读这段）

| 层级 | 作用 |
|------|------|
| **Excel 表头（中文）** | 每列第一行；导入时按「表头文字」解析，**不是**按列序号死绑（列顺序可变，但表头需能映射）。 |
| **`enterprise-headers.ts`** | 表头（及常见变体）→ Prisma 字段名；**一行表头可对应多个别名**（兼容旧模板）。 |
| **`enterprise-import.ts`** | 按字段类型做 `parseDate` / `parseBool` / 数值等；未进入映射的列写入 **`extraJson`**。 |
| **`EnterpriseRecord`（Prisma）** | 与「当前主模板」对齐的结构化列；历史数据可保留已废弃列（nullable）或仅存在于 `extraJson`。 |
| **迁移 `prisma/migrate`** | 真实库加列/改类型/索引；**两个工程 schema 改完后再 `generate`，部署环境执行 `migrate deploy`**。 |

**兼容旧模板的核心思路：** 在 **`HEADER_MAP` 里保留旧表头别名**，新表头映射到同一字段；数据库列尽量 **可空**，避免旧文件缺列时报错；**删除业务含义上的列**时，优先 **不再映射 + 列保留 nullable**（历史批次仍可查），而不是立刻删库列。

---

## 二、本次迁移（名单是否退回 / 退回原因）摘要

### 2.1 业务与模板

Excel 三 Sheet（一类 / 非常规名单 / 接力棒）在「是否见到客户」与「渠道」之间增加：

- **名单是否退回** → 库字段 `listReturned`（布尔）
- **退回原因** → 库字段 `returnReason`（长文本，可空）

### 2.2 代码与迁移文件

- **`oms/prisma/schema.prisma`** 与 **`crm/prisma/schema.prisma`**：`EnterpriseRecord` 增加 `listReturned`、`returnReason`（两处保持完全一致）。
- **`oms/src/lib/enterprise-headers.ts`**：`add("名单是否退回", "listReturned")`、`add("退回原因", "returnReason")`。
- **`oms/src/lib/enterprise-import.ts`**：`listReturned` 归入 `BOOL_FIELDS`。
- **OMS**：列表 / CSV / 编辑弹窗、`PATCH` 白名单等按需暴露新字段。
- **迁移**：`oms/prisma/migrations/20260411120000_add_enterprise_list_returned_fields/migration.sql`（`ALTER TABLE ... ADD COLUMN`），并配合 **`migration_lock.toml`**（MySQL）。

### 2.3 执行数据库更新（部署侧）

在配置好 `DATABASE_URL` 的环境：

```bash
cd oms
npx prisma migrate deploy
```

两工程本地或 CI 在 schema 变更后需分别执行：

```bash
npx prisma generate
```

### 2.4 CRM

本次仅 **共库、模型同步**；CRM 端若无产品需求，可不展示新字段。陌拜地图、客户经理匹配等逻辑 **不依赖** 这两项，一般无需改动。

---

## 三、后续变更类型与推荐策略

### 3.1 仅新增列（新模板多几列）

**目标：** 新文件能写入结构化字段；旧文件没有这些列，对应字段为 `NULL` 或走 `extraJson`（若暂未加映射）。

**推荐步骤：**

1. **Prisma**：在 `oms`、`crm` 的 `EnterpriseRecord` 上增加字段，类型以可空为主（`?`），除非业务强制必填。
2. **迁移**：`prisma migrate dev` 或手写 `migration.sql`（与团队规范一致），**生产执行 `migrate deploy`**。
3. **表头映射**：在 `enterprise-headers.ts` 中为 **新表头** 增加 `add("新列名", "字段名")`；若有多种叫法，**多个 `add` 指向同一字段**。
4. **导入类型**：在 `enterprise-import.ts` 中把字段加入 `DATE_FIELDS` / `BOOL_FIELDS` / `DECIMAL_FIELDS` / `INT_FIELDS` 之一，否则按字符串处理。
5. **OMS 展示/API**：列表、导出、可编辑字段、`PATCH` 白名单按需更新。
6. **CRM / H5**：仅当要在端上展示或筛选时再接线。

**注意：** 在映射补齐之前，新列会整列进入 **`extraJson`**（键为规范化后的表头），数据不丢，但查询、索引不友好；**上线结构化字段后建议补映射并重新导入或写一次性迁移脚本**（按业务决定）。

---

### 3.2 列「改名」（语义不变，Excel 表头从 A 改成 B）

**目标：** 旧模板仍用 A，新模板用 B，**都能导入到同一字段**。

**做法：** 在 **`enterprise-headers.ts`** 里 **不要删** `add("旧表头", "field")`，**再增加** `add("新表头", "field")`。  

数据库 **只保留一列** `field`，无需迁移改列名（除非 Prisma 字段名也要统一重命名，见下节）。

**注意：** `normalizeHeader` 会处理全角括号、空格等；若实际文件里有更多变体，按需补别名。

---

### 3.3 Prisma / 数据库字段改名（内部英文名变更）

若仅 Excel 表头不变，只是代码里 `foo` 改成 `bar`：

- 需要 **Prisma migrate** 做 `RENAME COLUMN`（或新建 + 数据拷贝 + 删旧列）。
- **`HEADER_MAP` 的值**改为新字段名 `bar`。
- **导入类型集合**、**OMS/C API**、**serialize** 全项目替换。

这是 **破坏性较强** 的变更，需评估历史数据与发布顺序。

---

### 3.4 模板「删列」（业务不再提供某列）

分两层理解：

**A. 不再从 Excel 接收该信息**

- 从新文件解析时该字段 **不会被写入**（旧行仍可有历史值）。
- 在 **`enterprise-headers.ts` 中可保留 `add("旧表头", "field")`**：用户仍上传含该列的旧模板时，数据仍会写入；**去掉 `add` 后**，该列会落入 **`extraJson`**（若仍需长期可读，可暂时保留映射）。

**B. 数据库是否删列**

- **不推荐**立刻 `DROP COLUMN`：历史批次、报表、对接可能仍依赖。
- 推荐：**列保留为可空**，应用层不再展示或标注「已废弃」；确需删列时走专门迁移窗口与数据归档。

---

### 3.5 既要旧模板能上传，又要新模板：实践清单

| 手段 | 说明 |
|------|------|
| **多表头 → 同一字段** | `enterprise-headers.ts` 多条 `add` |
| **新列仅新模板有** | Prisma 字段可空；旧文件无该列 → `NULL` |
| **旧列新模板没有** | 保留 DB 列可空；旧模板有则仍映射；新模板无则 `NULL` |
| **暂不能改表** | 新列先进 `extraJson`，待迁移后再加结构化字段并视情况补数据 |
| **版本化模板** | 可选：批次表或 `extraJson` 记 `templateVersion`；多数场景用可空列 + 别名即可 |

---

## 四、代码同步检查表（复制使用）

每次模板或库表变更，可按表勾选：

- [ ] **`oms/prisma/schema.prisma`** 与 **`crm/prisma/schema.prisma`** 一致  
- [ ] **迁移**：新增/修改 `prisma/migrations` 且 **已提交 Git**；生产已按 **「本地开发 → 生产上线」** 执行 **`migrate deploy`**（或经评审的手动 DDL + `resolve`）  
- [ ] **`npx prisma generate`**（OMS、CRM 各执行）  
- [ ] **`src/lib/enterprise-headers.ts`**：表头映射与别名  
- [ ] **`src/lib/enterprise-import.ts`**：日期/布尔/数值集合  
- [ ] **`enterprise-serialize.ts`**：若有 Decimal 等特殊序列化  
- [ ] **API**：`PATCH` / 列表接口是否允许读写新字段  
- [ ] **OMS `dashboard/enterprises`**：列表、CSV、编辑表单  
- [ ] **CRM**：仅当产品需要展示/筛选时  
- [ ] **README / 本文档**：大变更时更新「本次迁移」或别名说明  

---

## 五、常见风险与注意点

1. **数据是否会被删**：见文首 **「数据安全说明」**；默认「加可空列」迁移**不删历史行**。  
2. **双工程 schema 漂移**：只改 OMS 或只改 CRM，会导致另一工程 Prisma Client 与真实表不一致，运行时错误。  
3. **先迁移还是先发版**：一般 **先执行 DB 迁移**，再发依赖新列的应用；或新列可空且代码兼容 `undefined/null`。  
4. **`extraJson` 依赖**：长期依赖 `extraJson` 做核心业务筛选会增加复杂度；重要字段应进结构化列。  
5. **布尔与 Excel**：中文「是/否」、空单元格依赖 `parseBool` 行为，改解析规则需回归测试。  
6. **三 Sheet 列不一致**：非常规名单与一类/接力棒列数不同是设计如此；映射按 **表头** 而非列序，但每个 Sheet 内表头应与本表数据列对齐。  

---

## 六、相关文件路径（速查）

| 用途 | 路径 |
|------|------|
| Prisma 模型（OMS） | `oms/prisma/schema.prisma` |
| Prisma 模型（CRM，需与 OMS 一致） | `crm/prisma/schema.prisma` |
| 表头映射 | `oms/src/lib/enterprise-headers.ts` |
| 导入解析与类型 | `oms/src/lib/enterprise-import.ts`、`enterprise-parse.ts` |
| 导入 API | `oms/src/app/api/enterprises/import/route.ts` |
| 单条更新白名单 | `oms/src/app/api/enterprises/records/[id]/route.ts` |
| 三 Sheet 字段对比（脚本） | `ap/script/compare-sheets.mjs`、`sheet-compare-result.md` |

---

## 七、后续提问时可用的「对比话术」

做方案评审时，可以直接问清下面几点，并与本文策略对照：

1. **新列是否必须进结构化表？** 还是先进 `extraJson` 即可？  
2. **旧模板是否还要支持？** 是否要保留表头别名？  
3. **库表是否删列、是否重命名？** 对历史批次的影响？  
4. **发布顺序**：迁移与应用的先后？是否可空？（详见 **「本地开发 → 生产上线」**）  
5. **CRM/H5 是否要展示或筛选？**  

以上确定后，按 **第四节检查表** 改代码即可与历史方案对齐、减少遗漏。
