package com.ap.ap.model

data class Customer(
    val id: String,
    val name: String,
    val company: String,
    val address: String,
    val latitude: Double?,
    val longitude: Double?,
    val geocodeStatus: GeocodeStatus,
    val visitStatus: VisitStatus,
    val visitedAt: String? = null,
)

enum class VisitStatus {
    VISITED,
    UNVISITED,
}

enum class GeocodeStatus {
    SUCCESS,
    FAILED,
    PENDING,
}
