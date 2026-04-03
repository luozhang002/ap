# iOS（`ap`）

原生工程在 **`ap/`** 目录，使用 [CocoaPods](https://cocoapods.org/)。仓库根目录的 `.gitignore` 已忽略 `Pods/`，拉代码后需要本地生成依赖。

## 环境

- Xcode（与工程部署目标一致）
- CocoaPods：`sudo gem install cocoapods` 或使用 Bundler（若项目后续增加 `Gemfile`）

## 首次克隆 / 干净环境

```bash
cd mobile/ios/ap
pod install
```

之后请用 **`ap.xcworkspace`** 打开工程（不要单独打开 `ap.xcodeproj`），再编译运行。

## CI

在构建步骤中于 **`mobile/ios/ap`** 下执行 **`pod install`**（或 `pod install --repo-update`，按你们流水线策略选择）。版本以已提交的 **`Podfile.lock`** 为准。
