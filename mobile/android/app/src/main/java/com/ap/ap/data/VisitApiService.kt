package com.ap.ap.data

import com.ap.ap.model.Customer
import java.time.LocalDateTime
import java.util.UUID

data class CustomerQuery(
    val status: String? = null,
    val radiusKm: Int? = null,
    val centerLat: Double? = null,
    val centerLng: Double? = null,
)

data class VisitAudit(
    val visitId: String,
    val customerId: String,
    val operatorId: String,
    val action: String,
    val ts: String,
    val locationSnapshot: String,
)

class VisitApiService(
    private val repository: CustomerRepository
) {
    // TODO(api): 接入真实后端接口时，替换为 Retrofit/OkHttp 调用。
    // GET /customers?status=&radiusKm=&centerLat=&centerLng=
    private val visitAudits = mutableListOf<VisitAudit>()
    private val requestTokenSet = mutableSetOf<String>()

    fun getCustomers(query: CustomerQuery): List<Customer> {
        val all = repository.loadCustomers()
        return all.filter { customer ->
            val statusMatch = when (query.status) {
                "visited" -> customer.visitedAt != null
                "unvisited" -> customer.visitedAt == null
                else -> true
            }
            statusMatch
        }
    }

    fun markVisited(
        customerId: String,
        operatorId: String,
        clientLat: Double?,
        clientLng: Double?,
        idempotencyKey: String,
    ): Customer? {
        // TODO(api): 接入真实后端接口时，替换为 POST /customers/{id}/visit
        // 并将 idempotencyKey 放入请求头（例如 Idempotency-Key）。
        if (!requestTokenSet.add(idempotencyKey)) {
            return repository.loadCustomers().firstOrNull { it.id == customerId }
        }
        val updated = repository.markVisited(customerId)
        if (updated != null) {
            visitAudits += VisitAudit(
                visitId = UUID.randomUUID().toString(),
                customerId = customerId,
                operatorId = operatorId,
                action = "mark_visited",
                ts = LocalDateTime.now().toString(),
                locationSnapshot = "${clientLat ?: "n/a"},${clientLng ?: "n/a"}"
            )
        }
        return updated
    }

    fun listAuditRecords(): List<VisitAudit> = visitAudits.toList()
}
