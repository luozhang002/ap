# 高德地图接入说明（安卓拜访地图）

## 当前状态
- 目前 `拜访地图` 页面使用的是 `Compose Canvas` 模拟地图，数据为本地模拟数据。
- 需要替换为高德 Android 地图 SDK，当前代码里已加 `TODO(amap)` 和 `TODO(api)` 标注。

## 需要申请与准备
- 高德开放平台账号（企业或个人开发者）。
- 创建 Android 应用并获取 `Key`（Web 服务 Key 与 Android SDK Key 按需开通）。
- 配置 SHA1 + 包名白名单（发布与调试证书都建议配置）。
- 开通能力：
  - 地图 SDK（必需）
  - 定位 SDK（建议，用于“我的位置”）
  - 地理编码/逆地理编码 Web 服务（后端批处理地址转坐标）

## 安卓端接入步骤
1. 在高德开放平台创建应用并获取 Android `Key`。
2. 在 `app` 模块引入高德依赖（地图/定位）。
3. 在 `AndroidManifest.xml` 中配置：
   - 网络权限、定位权限
   - 高德 `apikey` 的 `meta-data`
4. 在地图页用 `MapView` 或 `TextureMapView` 替换当前模拟画布：
   - 初始化地图对象
   - 打开我的位置图层
   - 添加客户 `Marker`
   - 监听 `Marker` 点击事件，展示客户详情卡片
5. 按筛选条件更新 marker 集合（距离 + 拜访状态）。

## 接口对接点（已在代码加注释）
- 客户列表查询：
  - 目标接口：`GET /customers?status=&radiusKm=&centerLat=&centerLng=`
  - 当前位置：`app/src/main/java/com/ap/ap/data/VisitApiService.kt` 的 `getCustomers`
- 标记拜访：
  - 目标接口：`POST /customers/{id}/visit`
  - 当前位置：`app/src/main/java/com/ap/ap/data/VisitApiService.kt` 的 `markVisited`
- 地图页交互入口：
  - 当前位置：`app/src/main/java/com/ap/ap/ui/VisitMapScreen.kt`
  - 说明：把 `VisitMapCanvas` 替换为高德组件，并复用现有筛选与详情卡片逻辑。

## 后端地址转坐标建议
- 由后端批量执行地理编码，不在 App 端逐条调用。
- 新增字段建议：
  - `latitude`, `longitude`
  - `geocodeStatus`（success/failed/pending）
  - `geocodeUpdatedAt`
- 对失败地址进入重试队列或人工修正流程。

## 验收建议
- 地图可正确显示我的位置和客户点位。
- 红蓝点位与拜访状态一致。
- 点击 marker 可查看客户信息，未拜访可改为已拜访并实时变红。
- 距离筛选与状态筛选结果正确。
- 定位权限关闭时可降级访问并给出提示。
