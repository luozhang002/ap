import Foundation

enum VisitStatus: String, Codable, CaseIterable, Equatable {
    case visited = "VISITED"
    case unvisited = "UNVISITED"
}

enum GeocodeStatus: String, Codable, Equatable {
    case success = "SUCCESS"
    case failed = "FAILED"
    case pending = "PENDING"
}

struct Customer: Identifiable, Equatable {
    let id: String
    let name: String
    let company: String
    let address: String
    let latitude: Double?
    let longitude: Double?
    let geocodeStatus: GeocodeStatus
    let visitStatus: VisitStatus
    let visitedAt: String?
}

