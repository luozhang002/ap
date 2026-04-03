import SwiftUI
import CoreLocation

private let mockMyLat = 31.2304
private let mockMyLng = 121.4737

private enum VisitFilter: String, Hashable, CaseIterable {
    case all
    case visited
    case unvisited
}

struct VisitMapScreen: View {
    @StateObject private var viewModel = VisitMapViewModel()
    @StateObject private var locationAuthorizer = LocationAuthorizer()

    @State private var radiusKm: Int? = nil
    @State private var visitFilter: VisitFilter = .all
    @State private var selectedCustomerId: String? = nil

    @State private var myLocation: CLLocationCoordinate2D? = nil
    @State private var hasMovedCamera = false

    // 右下角自定义 + / - 缩放按钮的触发计数
    @State private var zoomInCount: Int = 0
    @State private var zoomOutCount: Int = 0

    private var permissionGranted: Bool { locationAuthorizer.isAuthorized }

    private var filteredCustomers: [Customer] {
        viewModel.customers.filter { customer in
            let statusMatch: Bool = {
                switch visitFilter {
                case .all:
                    return true
                case .visited:
                    return customer.visitStatus == .visited
                case .unvisited:
                    return customer.visitStatus == .unvisited
                }
            }()

            guard statusMatch else { return false }
            guard let radiusKm else { return true }
            guard let lat = customer.latitude, let lng = customer.longitude else { return false }

            let center = myLocation ?? CLLocationCoordinate2D(latitude: mockMyLat, longitude: mockMyLng)
            return distanceKm(
                myLat: center.latitude,
                myLng: center.longitude,
                targetLat: lat,
                targetLng: lng
            ) <= radiusKm
        }
    }

    private var selectedCustomer: Customer? {
        guard let id = selectedCustomerId else { return nil }
        return filteredCustomers.first(where: { $0.id == id })
    }

    private var cameraTarget: CLLocationCoordinate2D {
        if let myLocation { return myLocation }
        if let first = filteredCustomers.first(where: { $0.latitude != nil && $0.longitude != nil }),
           let lat = first.latitude,
           let lng = first.longitude {
            return CLLocationCoordinate2D(latitude: lat, longitude: lng)
        }
        return CLLocationCoordinate2D(latitude: mockMyLat, longitude: mockMyLng)
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            filterRow

            if !permissionGranted {
                permissionCard
                    .padding(.horizontal, 12)
                    .padding(.top, 6)
            }

            ZStack(alignment: .bottomTrailing) {
                VisitMapAMapView(
                    customers: filteredCustomers,
                    selectedCustomerId: $selectedCustomerId,
                    hasLocationPermission: permissionGranted,
                    cameraTarget: cameraTarget,
                    shouldMoveCamera: !hasMovedCamera,
                    hasMovedCamera: $hasMovedCamera,
                    zoomInCount: $zoomInCount,
                    zoomOutCount: $zoomOutCount,
                    onMyLocationUpdate: { coord in
                        myLocation = coord
                    }
                )
                .frame(height: 420)

                VStack(spacing: 8) {
                    Button {
                        zoomInCount += 1
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 34, height: 34)
                            .background(Color.black.opacity(0.55))
                            .clipShape(Circle())
                    }
                    Button {
                        zoomOutCount += 1
                    } label: {
                        Image(systemName: "minus")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 34, height: 34)
                            .background(Color.black.opacity(0.55))
                            .clipShape(Circle())
                    }
                }
                .padding(.trailing, 10)
                .padding(.bottom, 10)
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)

            if let selectedCustomer {
                CustomerInfoCard(
                    customer: selectedCustomer,
                    canMarkVisited: selectedCustomer.visitStatus == .unvisited,
                    onMarkVisited: {
                        viewModel.markVisited(customerId: selectedCustomer.id)
                    }
                )
                .padding(.horizontal, 12)
                .padding(.bottom, 16)
            } else {
                Text("点击地图点位查看客户信息")
                    .foregroundColor(.secondary)
                    .padding(14)
                Spacer(minLength: 0)
            }
        }
        .onAppear { viewModel.reload() }
    }
}

private extension VisitMapScreen {
    var header: some View {
        HStack {
            Text("拜访地图")
                .font(.headline)
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
    }

    var filterRow: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                ForEach([nil, 1, 3, 5, 10], id: \.self) { km in
                    let selected = (radiusKm == km)
                    Button {
                        radiusKm = km
                    } label: {
                        Text(km == nil ? "不限" : "\(km!)km")
                            .font(.subheadline)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .foregroundColor(selected ? .white : .primary)
                            .background(selected ? Color.blue : Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }
            }

            Picker("状态", selection: $visitFilter) {
                Text("全部").tag(VisitFilter.all)
                Text("未拜访").tag(VisitFilter.unvisited)
                Text("已拜访").tag(VisitFilter.visited)
            }
            .pickerStyle(.segmented)
        }
        .padding(.horizontal, 12)
        .padding(.top, 10)
        .padding(.bottom, 4)
    }

    var permissionCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("定位权限未开启，距离筛选与我的位置将不可用。")
                .font(.subheadline)
                .foregroundColor(.primary)
            Button {
                locationAuthorizer.requestWhenInUse()
            } label: {
                Text("开启定位权限")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.blue)
        }
        .padding(12)
        .background(Color(red: 1.0, green: 0.96, blue: 0.90))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct CustomerInfoCard: View {
    let customer: Customer
    let canMarkVisited: Bool
    let onMarkVisited: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(customer.name)
                .font(.headline)
            Text(customer.company)
                .foregroundColor(.secondary)
            Text(customer.address)
                .foregroundColor(.secondary)

            if customer.geocodeStatus == .failed {
                Text("地址待校准")
                    .foregroundColor(Color(red: 0.89, green: 0.42, blue: 0.0))
                    .font(.subheadline)
            }

            if customer.visitStatus == .visited {
                Text("已拜访：\(customer.visitedAt ?? "已记录")")
                    .foregroundColor(Color(red: 0.69, green: 0.19, blue: 0.19))
                    .font(.subheadline)
            } else {
                Text("未拜访")
                    .foregroundColor(Color(red: 0.14, green: 0.50, blue: 1.0))
                    .font(.subheadline)
            }

            if canMarkVisited {
                Button(action: onMarkVisited) {
                    Text("标记为已拜访")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.blue)
                .padding(.top, 8)
            }
        }
        .padding(14)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
    }
}

