Pod::Spec.new do |s|
  # 使用 podspec 所在目录动态定位 Vendor 里的 SDK 框架文件，避免 CocoaPods
  # 从本地 git source 拉取后导致相对路径丢失的问题。
  sdkRoot = File.expand_path('Vendor/AMapSDK', __dir__)

  s.name         = 'AMapSDK'
  s.version      = '1.0.1'
  s.summary      = 'Local packaged AMap iOS SDK'
  s.homepage     = 'https://lbs.amap.com/'
  s.authors      = { 'amap' => 'amap' }
  # 声明为本地 podspec（仅用于满足 CocoaPods 的校验）
  # 使用 podspec 所在目录作为 source，确保 CocoaPods 可以找到 Vendor 里的框架文件。
  s.source       = { :path => '.' }
  s.license      = { :type => 'Proprietary' }

  s.platform     = :ios, '15.0'

  # 你需要把高德 SDK 放到：
  # mobile/ios/ap/Vendor/AMapSDK/
  #
  # 然后把下面 vendored_frameworks 的文件名替换成你解压出来的实际名称。
  #
  # 常见三类：
  # - MAMapKit（地图）
  # - AMapFoundationKit（基础）
  # Demo 里的 framework 只有 2D 地图（不一定包含 AMapLocationKit）。
  s.vendored_frameworks = [
    File.join(sdkRoot, 'MAMapKit.framework'),
    File.join(sdkRoot, 'AMapFoundationKit.framework'),
    File.join(sdkRoot, 'AMapSearchKit.framework'),
  ]

  # AMap iOS SDK 内部会用到一些系统框架/库（否则会在 link 阶段出现 undefined symbols）。
  s.frameworks = [
    'UIKit',
    'Foundation',
    'CoreLocation',
    # AMap internal dependencies (from undefined symbols)
    'CoreWLAN',
    'CoreTelephony',
    'SystemConfiguration',
    # Vendored frameworks
    'MAMapKit',
    'AMapFoundationKit',
    'AMapSearchKit',
  ]
  # AMap 内部包含 zip/gzip/CRC 等实现，依赖系统 zlib
  s.libraries = ['z']

  # 显式给出搜索路径：否则 CocoaPods 只加了 `-framework XXX`，但链接器找不到对应的
  # `.framework` 所在目录（表现为 `ld: framework 'AMapFoundationKit' not found`）。
  s.pod_target_xcconfig = {
    'FRAMEWORK_SEARCH_PATHS' => "$(inherited) \"#{sdkRoot}\""
  }

  # 给使用方（用户工程/app target）生效的配置字段通常是 user_target_xcconfig。
  s.user_target_xcconfig = {
    'FRAMEWORK_SEARCH_PATHS' => "$(inherited) \"#{sdkRoot}\"",
    # 追加 AMapFoundationKit/MAMapKit 运行时依赖的系统框架与库（否则链接阶段会 undefined symbols）。
    'OTHER_LDFLAGS' => '$(inherited) -framework "CoreTelephony" -framework "SystemConfiguration" -framework "CoreWLAN" -lz'
  }
end

