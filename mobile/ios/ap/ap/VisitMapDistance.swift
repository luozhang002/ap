import Foundation

/// Android 端同样的距离近似算法（用于距离筛选）。
/// - Returns: 距离（公里，取整）
func distanceKm(myLat: Double, myLng: Double, targetLat: Double, targetLng: Double) -> Int {
    let latGap = abs(myLat - targetLat) * 111.0
    let lngGap = abs(myLng - targetLng) * 96.0
    return Int((latGap * latGap + lngGap * lngGap).squareRoot())
}

