# iOS 高德地图（AMap）接入与排障沉淀文档

本文档用于记录：在 `mobile/ios/ap` 工程里接入高德 iOS SDK（`MAMapKit / AMapFoundationKit / AMapSearchKit`）时，遇到过的关键坑与对应解决步骤。

> 说明：本文不包含真实 `AMap API Key`，工程中以代码或配置方式自行填写。

---

## 1. 工程里涉及的关键目录/文件

1. 本地 AMap SDK（framework 直托管）
   - `mobile/ios/ap/Vendor/AMapSDK/`
   - 需要至少包含：
     - `MAMapKit.framework`
     - `AMapFoundationKit.framework`
     - `AMapSearchKit.framework`

2. CocoaPods（本地 podspec）
   - `mobile/ios/ap/AMapSDK.podspec`
   - `mobile/ios/ap/Podfile`

3. Xcode 工程配置（嵌入/签名/搜索路径）
   - `mobile/ios/ap/ap.xcodeproj/project.pbxproj`
   - 重点关注 `ap` target 的：
     - `FRAMEWORK_SEARCH_PATHS`
     - `PBXCopyFilesBuildPhase`（Embed/Copy AMap frameworks）
     - `PBXBuildFile` 的 `CodeSignOnCopy` 属性

4. SwiftUI 地图视图
   - `mobile/ios/ap/ap/VisitMapAMapViewRepresentable.swift`
   - `mobile/ios/ap/ap/VisitMapScreen.swift`

---

## 2. 必须配置（否则常见现象：占位文案不消失/真机装不上/地图不渲染）

### 2.1 确保 Swift 能 `import MAMapKit`（占位文案不消失的核心原因）

如果页面显示类似：
- `未集成高德 iOS SDK（MAMapKit/AMapLocationKit）`

通常说明运行时走到了 `#else`（`canImport(MAMapKit)` 为 `false`），原因一般是：framework 缺少 `Modules/module.modulemap`，导致 Swift/Clang 无法把它当成“可导入模块”。

对每个 framework 添加 modulemap：
- `Vendor/AMapSDK/MAMapKit.framework/Modules/module.modulemap`
- `Vendor/AMapSDK/AMapFoundationKit.framework/Modules/module.modulemap`
- `Vendor/AMapSDK/AMapSearchKit.framework/Modules/module.modulemap`

modulemap 内容的形态为：
```modulemap
framework module MAMapKit {
  umbrella header "MAMapKit.h"
  export *
  module * { export * }
}
```

（其中 umbrella header 名称需与对应 framework `Headers/` 下的头文件一致。）

验证：
1. Xcode 里 `Product -> Clean Build Folder`
2. 真机端删除旧 app
3. 使用 `ap.xcworkspace` Run/Install
4. 占位文案应消失，并能创建真正的 `MAMapView`

---

### 2.2 真机安装签名：使用 Xcode 的 `CodeSignOnCopy`

如果真机安装失败，报：
- `Failed to verify code signature ... AMapSearchKit.framework ... (The executable contains an invalid signature.)`

解决原则：
1. **不要**使用自定义 `PBXShellScriptBuildPhase` 在 sandbox 中手动 `codesign` AMap frameworks（容易出现 `Operation not permitted` 或签名链异常）
2. 使用 Xcode 原生机制：给 `PBXCopyFilesBuildPhase` 对应的 AMap framework 嵌入项配置 `CodeSignOnCopy`

具体做法（概念层面）：
1. 找到 `ap` target 的 `PBXCopyFilesBuildPhase`（例如名为 Embed/Copy AMap frameworks）
2. 确保把以下 framework 的 copy/embed buildfile 设置了：
   - `settings = { ATTRIBUTES = (CodeSignOnCopy, ...); }`
3. 记得把 `RemoveHeadersOnCopy` 一并带上（可选但通常更贴近 Xcode 默认行为）

验证：
1. 真机上先删除旧 app
2. 再 Run/Install
3. 不应再出现 `invalid signature` 安装失败

---

### 2.3 工程能找到框架：`FRAMEWORK_SEARCH_PATHS`

`ap.xcodeproj` 里 `ap` target 的 Debug/Release 需要包含：
- `$(SRCROOT)/Vendor/AMapSDK`

否则容易出现 linker 找不到 framework 的问题。

---

## 3. Swift 代码建议（避免底图不渲染）

### 3.1 首次渲染时机

在 `VisitMapAMapViewRepresentable.swift` 里建议：
1. `MAMapView` 初始化时不要用 `.zero` frame（改为一个非 0 尺寸，例如 `1x1`）
2. 首次 `setCenter` / `setZoomLevel` 放到 `DispatchQueue.main.async`，并在执行前做 `layoutIfNeeded()`
3. 最后触发 `setNeedsDisplay()`

目的：
- 避免 SwiftUI 首次布局尚未完成时就执行镜头操作，造成底图渲染时机异常。

---

### 3.2 SDK API 名称差异

不同版本 iOS SDK 的 Swift 导出/API 命名可能不同（会出现类似：
- `sharedServices()` 重命名
- `updatePrivacyAgree` 不存在
- delegate 方法签名变化
）

处理方式：
1. 以本地 `Vendor/AMapSDK/*/Headers/*.h` 的真实签名为准
2. 在 Swift 里逐个修正对应方法/属性名

---

## 4. 常见问题 -> 对应解法

### 4.1 占位文案一直在
现象：
- 页面显示 `未集成高德 iOS SDK ...`
原因：
- `#if canImport(MAMapKit)` 为 false（模块导入失败）
解法：
1. 添加 `Modules/module.modulemap`（见 2.1）
2. Clean Build + 真机删除旧 app + 用 xcworkspace 重装

---

### 4.2 真机安装报 `invalid signature`
现象：
- `Failed to verify code signature ... AMapSearchKit.framework ... 0xe8008014`
原因：
- framework 嵌入到 app bundle 时未被正确签名
解法：
1. 给 `PBXCopyFilesBuildPhase` 的 AMap framework copy buildfile 设置 `CodeSignOnCopy`
2. 移除/避免自定义 sandbox codesign 脚本
3. 真机删旧 app 后重装

---

### 4.3 链接阶段 undefined symbols / 缺系统依赖
现象：
- `_SCNetworkReachability*`
- `_CNCopyCurrentNetworkInfo`
- `std::__1::*` 相关缺符号
- `inflate/deflate/zlib` 相关缺符号
解法思路：
1. 在工程 link 参数里补齐 AMap 运行时依赖的系统框架/库
2. 尤其注意：
   - `-framework SystemConfiguration`
   - `-framework CoreTelephony`
   - `-lz`
   - C++ 运行库：`-lc++ -lc++abi`

> 说明：这些依赖补齐位置在 `ap.xcodeproj` 的 `ap` target link 配置中实现，确保 app target 的 link 阶段一定带上。

---

### 4.4 Xcode 报 `No space left on device`
现象：
- `Couldn't create workspace arena folder`
解法：
1. 清理 `DerivedData`
2. 清理 `CoreSimulator/Devices`
3. 保证磁盘可用空间，再重新 Clean Build

---

## 5. 标准验证流程（建议每次改完都走）

1. Xcode：`Product -> Clean Build Folder`
2. 真机：删除旧 app
3. 用 `ap.xcworkspace` Run/Install
4. 页面：
   - 占位文案是否消失
   - 底图是否渲染
   - 点位图钉是否可见
5. Console（若需要定位）：
   - 搜索 `[AMap]` 或 AMap 相关打印日志

