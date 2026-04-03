import SwiftUI
import CoreLocation

// 高德 Key：来自用户提供
private let amapApiKey = "c35c12a8e052677b7c5724de492d5608"
private let mockMyLat = 31.2304
private let mockMyLng = 121.4737

#if canImport(MAMapKit) && canImport(AMapFoundationKit)
import MAMapKit
import AMapFoundationKit

#if canImport(AMapLocationKit)
import AMapLocationKit
#endif

final class CustomerPointAnnotation: MAPointAnnotation {
    var customerId: String = ""
    var isVisited: Bool = false
}

struct VisitMapAMapView: UIViewRepresentable {
    let customers: [Customer]
    @Binding var selectedCustomerId: String?
    let hasLocationPermission: Bool

    let cameraTarget: CLLocationCoordinate2D
    let shouldMoveCamera: Bool
    @Binding var hasMovedCamera: Bool

    // 用于触发右下角自定义 + / - 缩放按钮（避免直接把 UIView 指针暴露给 SwiftUI）。
    @Binding var zoomInCount: Int
    @Binding var zoomOutCount: Int

    let onMyLocationUpdate: (CLLocationCoordinate2D) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> MAMapView {
        // 设置 API Key
        AMapServices.shared().apiKey = amapApiKey

        // 注意：不同版本 iOS SDK 的“隐私合规”API 名称不一致。
        // 你当前 Vendor 里的 headers 不包含 updatePrivacyAgree/updatePrivacyShow 等方法，因此这里先不做调用，
        // 以保证工程能编译并能跑通地图渲染流程。
        print("[AMap] makeUIView: creating MAMapView, apiKey set:", amapApiKey)

        // MAMapView 在首次初始化时 frame 如果是 0，部分机型上可能导致底图渲染时机异常。
        // 这里保留一个极小的 frame；同时不手动改 auto layout，让 SwiftUI 正常负责布局。
        let mapView = MAMapView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
        mapView.delegate = context.coordinator
        mapView.isShowsUserLocation = hasLocationPermission
        mapView.setZoomLevel(11, animated: false)

        #if canImport(AMapLocationKit)
        context.coordinator.ensureLocationManager()
        if hasLocationPermission {
            context.coordinator.locationManager?.startUpdatingLocation()
        }
        #endif

        return mapView
    }

    func updateUIView(_ mapView: MAMapView, context: Context) {
        mapView.isShowsUserLocation = hasLocationPermission

        #if canImport(AMapLocationKit)
        if hasLocationPermission {
            context.coordinator.ensureLocationManager()
            context.coordinator.locationManager?.startUpdatingLocation()
        } else {
            context.coordinator.locationManager?.stopUpdatingLocation()
        }
        #endif

        // 1) 更新点位
        let existing = mapView.annotations.filter { $0 is CustomerPointAnnotation }
        mapView.removeAnnotations(existing)

        for c in customers {
            guard let lat = c.latitude, let lng = c.longitude else { continue }
            let ann = CustomerPointAnnotation()
            ann.coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
            ann.title = c.name
            ann.customerId = c.id
            ann.isVisited = (c.visitStatus == .visited)
            mapView.addAnnotation(ann)
        }

        // 2) 仅首次移动镜头
        if shouldMoveCamera && !hasMovedCamera {
            // 等到 SwiftUI 完成一次布局后再设置镜头，避免 “底图尚未开始渲染就被 setCenter/resetZoom”。
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                mapView.layoutIfNeeded()
                mapView.setCenter(self.cameraTarget, animated: false)
                mapView.setZoomLevel(11, animated: false)
                mapView.setNeedsDisplay()
                hasMovedCamera = true
            }
        }

        // 3) 处理自定义缩放按钮事件
        let zoomStep: Double = 1.0
        if context.coordinator.lastZoomInCount != zoomInCount {
            let newZoom = min(mapView.zoomLevel + zoomStep, mapView.maxZoomLevel)
            mapView.setZoomLevel(newZoom, animated: true)
            context.coordinator.lastZoomInCount = zoomInCount
        }
        if context.coordinator.lastZoomOutCount != zoomOutCount {
            let newZoom = max(mapView.zoomLevel - zoomStep, mapView.minZoomLevel)
            mapView.setZoomLevel(newZoom, animated: true)
            context.coordinator.lastZoomOutCount = zoomOutCount
        }

        // bounds 从 1x1 变成真实尺寸后，强制触发一次重绘，避免偶发“灰块/无瓦片”
        let size = mapView.bounds.size
        if size != context.coordinator.lastBoundsSize, size.width > 10, size.height > 10 {
            context.coordinator.lastBoundsSize = size
            mapView.setZoomLevel(mapView.zoomLevel, animated: false)
            mapView.setNeedsDisplay()
        }
    }

    #if canImport(AMapLocationKit)
    final class Coordinator: NSObject, MAMapViewDelegate, AMapLocationManagerDelegate {
        var parent: VisitMapAMapView
        var locationManager: AMapLocationManager?

        var lastZoomInCount: Int = 0
        var lastZoomOutCount: Int = 0
        var lastBoundsSize: CGSize = .zero

        init(parent: VisitMapAMapView) {
            self.parent = parent
            super.init()
        }

        func ensureLocationManager() {
            guard locationManager == nil else { return }
            let manager = AMapLocationManager()
            manager.delegate = self
            locationManager = manager
        }

        func mapView(_ mapView: MAMapView!, didSelect view: MAAnnotationView!) {
            guard let ann = view.annotation as? CustomerPointAnnotation else { return }
            parent.selectedCustomerId = ann.customerId
        }

        func mapView(_ mapView: MAMapView!, viewFor annotation: MAAnnotation!) -> MAAnnotationView! {
            guard let ann = annotation as? CustomerPointAnnotation else { return nil }

            let identifier = ann.isVisited ? "visited-pin" : "unvisited-pin"
            let v: MAAnnotationView
            if let reused = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) {
                v = reused
                v.annotation = ann
            } else {
                v = MAAnnotationView(annotation: ann, reuseIdentifier: identifier)
            }
            v.canShowCallout = false

            let symbolName = ann.isVisited ? "mappin.circle.fill" : "mappin.circle"
            let color: UIColor = ann.isVisited ? .systemRed : .systemBlue
            let img = UIImage(systemName: symbolName)?.withTintColor(color, renderingMode: .alwaysOriginal)
            v.image = img
            v.centerOffset = CGPoint(x: 0, y: -10)
            return v
        }

        func mapView(_ mapView: MAMapView!, didUpdate userLocation: MAUserLocation!, updatingLocation: Bool) {
            guard let coord = userLocation.location?.coordinate else { return }
            parent.onMyLocationUpdate(coord)
        }

        func amapLocationManager(_ manager: AMapLocationManager!, didUpdate location: CLLocation!) {
            guard let coord = location?.coordinate else { return }
            parent.onMyLocationUpdate(coord)
        }
    }
    #else
    final class Coordinator: NSObject, MAMapViewDelegate {
        var parent: VisitMapAMapView

        var lastZoomInCount: Int = 0
        var lastZoomOutCount: Int = 0
        var lastBoundsSize: CGSize = .zero

        init(parent: VisitMapAMapView) {
            self.parent = parent
            super.init()
        }

        func mapView(_ mapView: MAMapView!, didSelect view: MAAnnotationView!) {
            guard let ann = view.annotation as? CustomerPointAnnotation else { return }
            parent.selectedCustomerId = ann.customerId
        }

        func mapView(_ mapView: MAMapView!, viewFor annotation: MAAnnotation!) -> MAAnnotationView! {
            guard let ann = annotation as? CustomerPointAnnotation else { return nil }

            let identifier = ann.isVisited ? "visited-pin" : "unvisited-pin"
            let v: MAAnnotationView
            if let reused = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) {
                v = reused
                v.annotation = ann
            } else {
                v = MAAnnotationView(annotation: ann, reuseIdentifier: identifier)
            }
            v.canShowCallout = false

            let symbolName = ann.isVisited ? "mappin.circle.fill" : "mappin.circle"
            let color: UIColor = ann.isVisited ? .systemRed : .systemBlue
            let img = UIImage(systemName: symbolName)?.withTintColor(color, renderingMode: .alwaysOriginal)
            v.image = img
            v.centerOffset = CGPoint(x: 0, y: -10)
            return v
        }

        func mapView(_ mapView: MAMapView!, didUpdate userLocation: MAUserLocation!, updatingLocation: Bool) {
            guard let coord = userLocation.location?.coordinate else { return }
            parent.onMyLocationUpdate(coord)
        }
    }
    #endif
}

#else
/// 未集成高德 iOS SDK 时的占位实现（保证工程可编译；接入 SDK 后将自动启用上面的版本）。
struct VisitMapAMapView: UIViewRepresentable {
    let customers: [Customer]
    @Binding var selectedCustomerId: String?
    let hasLocationPermission: Bool

    let cameraTarget: CLLocationCoordinate2D
    let shouldMoveCamera: Bool
    @Binding var hasMovedCamera: Bool

    let onMyLocationUpdate: (CLLocationCoordinate2D) -> Void

    func makeUIView(context: Context) -> UIView {
        print("[AMap] makeUIView: fallback placeholder (MAMapKit not importable)")
        let v = UIView()
        v.backgroundColor = .systemGroupedBackground
        let label = UILabel()
        label.text = "未集成高德 iOS SDK（MAMapKit/AMapLocationKit）"
        label.textAlignment = .center
        label.numberOfLines = 0
        label.textColor = .secondaryLabel
        label.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: v.leadingAnchor, constant: 16),
            label.trailingAnchor.constraint(equalTo: v.trailingAnchor, constant: -16),
            label.topAnchor.constraint(equalTo: v.topAnchor, constant: 16),
            label.bottomAnchor.constraint(equalTo: v.bottomAnchor, constant: -16),
        ])
        return v
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}
#endif

