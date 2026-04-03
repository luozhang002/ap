import Foundation
import Combine
import Combine

struct VisitAudit: Equatable {
    let visitId: String
    let customerId: String
    let operatorId: String
    let action: String
    let ts: String
    let locationSnapshot: String
}

final class VisitApiService {
    private let repository: CustomerRepository
    private var visitAudits: [VisitAudit] = []
    private var requestTokenSet: Set<String> = []

    init(repository: CustomerRepository) {
        self.repository = repository
    }

    /// 当前仅做 mock：Android/H5 都是先用本地数据源模拟，后续替换为真实接口即可。
    func getCustomers(status: String?) -> [Customer] {
        let all = repository.loadCustomers()
        return all.filter { customer in
            switch status {
            case "visited":
                return customer.visitedAt != nil
            case "unvisited":
                return customer.visitedAt == nil
            default:
                return true
            }
        }
    }

    func markVisited(
        customerId: String,
        operatorId: String,
        clientLat: Double?,
        clientLng: Double?,
        idempotencyKey: String
    ) -> Customer? {
        guard requestTokenSet.insert(idempotencyKey).inserted else {
            return repository.loadCustomers().first(where: { $0.id == customerId })
        }

        let updated = repository.markVisited(customerId: customerId)
        guard let updated else { return nil }

        let nowStr = DateFormatter.visitTsFormatter.string(from: Date())
        visitAudits.append(
            VisitAudit(
                visitId: UUID().uuidString,
                customerId: customerId,
                operatorId: operatorId,
                action: "mark_visited",
                ts: nowStr,
                locationSnapshot: "\(clientLat?.description ?? "n/a"),\(clientLng?.description ?? "n/a")"
            )
        )
        return updated
    }

    func listAuditRecords() -> [VisitAudit] {
        visitAudits
    }
}

final class VisitMapViewModel: ObservableObject {
    @Published private(set) var customers: [Customer] = []

    private let repository = CustomerRepository()
    private lazy var api = VisitApiService(repository: repository)

    init() {
        reload()
    }

    func reload() {
        customers = repository.loadCustomers()
    }

    func markVisited(customerId: String, operatorId: String = "sales_manager_001") {
        _ = api.markVisited(
            customerId: customerId,
            operatorId: operatorId,
            clientLat: nil,
            clientLng: nil,
            idempotencyKey: "visit-\(customerId)"
        )
        reload()
    }
}

private extension DateFormatter {
    static var visitTsFormatter: DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_CN")
        f.timeZone = TimeZone.current
        f.dateFormat = "yyyy-MM-dd HH:mm"
        return f
    }
}

