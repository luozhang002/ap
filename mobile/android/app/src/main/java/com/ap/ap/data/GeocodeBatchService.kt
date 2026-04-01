package com.ap.ap.data

import com.ap.ap.model.Customer
import com.ap.ap.model.GeocodeStatus

class GeocodeBatchService {
    /**
     * 生产环境可替换为后端异步地理编码任务，当前使用本地规则模拟结果。
     */
    fun enrichCoordinates(customers: List<Customer>): List<Customer> {
        return customers.map { customer ->
            if (customer.latitude != null && customer.longitude != null) {
                customer.copy(geocodeStatus = GeocodeStatus.SUCCESS)
            } else {
                val generated = generateByAddress(customer.address)
                if (generated == null) {
                    customer.copy(geocodeStatus = GeocodeStatus.FAILED)
                } else {
                    customer.copy(
                        latitude = generated.first,
                        longitude = generated.second,
                        geocodeStatus = GeocodeStatus.SUCCESS
                    )
                }
            }
        }
    }

    private fun generateByAddress(address: String): Pair<Double, Double>? {
        val hash = address.hashCode()
        if (hash % 5 == 0) return null
        val lat = 31.18 + (hash and 0x3F) * 0.001
        val lng = 121.36 + ((hash shr 4) and 0x7F) * 0.001
        return lat to lng
    }
}
