package com.ap.ap.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.amap.api.maps.CameraUpdateFactory
import com.amap.api.maps.MapView
import com.amap.api.maps.model.BitmapDescriptorFactory
import com.amap.api.maps.model.LatLng
import com.amap.api.maps.model.MarkerOptions
import com.ap.ap.model.Customer
import com.ap.ap.model.GeocodeStatus
import com.ap.ap.model.VisitStatus

private enum class VisitFilter { ALL, VISITED, UNVISITED }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisitMapScreen(
    customers: List<Customer>,
    onBack: () -> Unit,
    onMarkVisited: (String) -> Unit,
) {
    var radiusKm by remember { mutableStateOf<Int?>(null) }
    var visitFilter by remember { mutableStateOf(VisitFilter.ALL) }
    var selectedCustomerId by remember { mutableStateOf<String?>(null) }
    var hasMovedCamera by remember { mutableStateOf(false) }
    var myLocation by remember { mutableStateOf<LatLng?>(null) }

    val context = LocalContext.current
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasLocationPermission = granted
    }

    val filtered = customers.filter { customer ->
        val statusMatch = when (visitFilter) {
            VisitFilter.ALL -> true
            VisitFilter.VISITED -> customer.visitStatus == VisitStatus.VISITED
            VisitFilter.UNVISITED -> customer.visitStatus == VisitStatus.UNVISITED
        }
        val radiusMatch = if (radiusKm == null) {
            true
        } else {
            val center = myLocation ?: LatLng(MOCK_MY_LAT, MOCK_MY_LNG)
            customer.latitude != null &&
                customer.longitude != null &&
                distanceKm(
                    myLat = center.latitude,
                    myLng = center.longitude,
                    targetLat = customer.latitude,
                    targetLng = customer.longitude
                ) <= radiusKm!!
        }
        statusMatch && radiusMatch
    }
    val selected = filtered.firstOrNull { it.id == selectedCustomerId }
    val mapView = rememberMapViewWithLifecycle()
    val currentCustomers = rememberUpdatedState(filtered)
    val currentHasLocationPermission = rememberUpdatedState(hasLocationPermission)
    val onMarkerClickState = rememberUpdatedState<(String) -> Unit> { id -> selectedCustomerId = id }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("拜访地图") },
            navigationIcon = {
                Button(onClick = onBack, modifier = Modifier.padding(start = 8.dp)) { Text("返回") }
            }
        )
        FilterRow(
            radiusKm = radiusKm,
            visitFilter = visitFilter,
            onRadiusChanged = { radiusKm = it },
            onVisitFilterChanged = { visitFilter = it }
        )

        if (!hasLocationPermission) {
            Card(
                modifier = Modifier
                    .padding(horizontal = 12.dp)
                    .fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF4E5))
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("定位权限未开启，距离筛选与我的位置将不可用。")
                    Button(onClick = {
                        permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                    }) {
                        Text("开启定位权限")
                    }
                }
            }
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = {
                    mapView.apply { onCreate(Bundle()) }
                },
                update = {
                    val aMap = it.map
                    aMap.uiSettings.isZoomControlsEnabled = true
                    aMap.uiSettings.isScaleControlsEnabled = true
                    aMap.isMyLocationEnabled = currentHasLocationPermission.value
                    aMap.setOnMyLocationChangeListener { location ->
                        myLocation = LatLng(location.latitude, location.longitude)
                    }
                    aMap.setOnMarkerClickListener { marker ->
                        val id = marker.`object` as? String ?: return@setOnMarkerClickListener true
                        onMarkerClickState.value(id)
                        true
                    }

                    aMap.clear()
                    currentCustomers.value.forEach { customer ->
                        val lat = customer.latitude ?: return@forEach
                        val lng = customer.longitude ?: return@forEach
                        val marker = aMap.addMarker(
                            MarkerOptions()
                                .position(LatLng(lat, lng))
                                .title(customer.name)
                                .snippet(customer.company)
                                .icon(
                                    BitmapDescriptorFactory.defaultMarker(
                                        if (customer.visitStatus == VisitStatus.VISITED) {
                                            BitmapDescriptorFactory.HUE_RED
                                        } else {
                                            BitmapDescriptorFactory.HUE_AZURE
                                        }
                                    )
                                )
                        )
                        marker?.`object` = customer.id
                    }

                    if (!hasMovedCamera) {
                        val first = currentCustomers.value.firstOrNull { p -> p.latitude != null && p.longitude != null }
                        val cameraTarget = if (myLocation != null) {
                            myLocation!!
                        } else if (first != null) {
                            LatLng(first.latitude!!, first.longitude!!)
                        } else {
                            LatLng(MOCK_MY_LAT, MOCK_MY_LNG)
                        }
                        aMap.moveCamera(CameraUpdateFactory.newLatLngZoom(cameraTarget, 11f))
                        hasMovedCamera = true
                    }
                }
            )
        }

        selected?.let { customer ->
            CustomerInfoCard(
                customer = customer,
                canMarkVisited = customer.visitStatus == VisitStatus.UNVISITED,
                onMarkVisited = { onMarkVisited(customer.id) }
            )
        } ?: run {
            Text(
                text = "点击地图点位查看客户信息",
                modifier = Modifier.padding(14.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun FilterRow(
    radiusKm: Int?,
    visitFilter: VisitFilter,
    onRadiusChanged: (Int?) -> Unit,
    onVisitFilterChanged: (VisitFilter) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(null, 1, 3, 5, 10).forEach { km ->
                FilterChip(
                    selected = radiusKm == km,
                    onClick = { onRadiusChanged(km) },
                    label = { Text(if (km == null) "不限" else "${km}km") },
                    colors = FilterChipDefaults.filterChipColors()
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AssistChip(
                onClick = { onVisitFilterChanged(VisitFilter.ALL) },
                label = { Text("全部") },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = if (visitFilter == VisitFilter.ALL) Color(0xFFE0ECFF) else Color.Transparent
                )
            )
            AssistChip(
                onClick = { onVisitFilterChanged(VisitFilter.UNVISITED) },
                label = { Text("未拜访") },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = if (visitFilter == VisitFilter.UNVISITED) Color(0xFFD6EAFF) else Color.Transparent
                )
            )
            AssistChip(
                onClick = { onVisitFilterChanged(VisitFilter.VISITED) },
                label = { Text("已拜访") },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = if (visitFilter == VisitFilter.VISITED) Color(0xFFFFE0E0) else Color.Transparent
                )
            )
        }
    }
}

@Composable
private fun CustomerInfoCard(
    customer: Customer,
    canMarkVisited: Boolean,
    onMarkVisited: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 10.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(customer.name, fontWeight = FontWeight.SemiBold)
            Text(customer.company)
            Text(customer.address)
            if (customer.geocodeStatus == GeocodeStatus.FAILED) {
                Text("地址待校准", color = Color(0xFFE26A00))
            }
            if (customer.visitStatus == VisitStatus.VISITED) {
                Text("已拜访：${customer.visitedAt ?: "已记录"}", color = Color(0xFFB03030))
            } else {
                Text("未拜访", color = Color(0xFF2A7FFF))
            }
            if (canMarkVisited) {
                Button(onClick = onMarkVisited) {
                    Text("标记为已拜访")
                }
            }
        }
    }
}

private const val MOCK_MY_LAT = 31.2304
private const val MOCK_MY_LNG = 121.4737

private fun distanceKm(myLat: Double, myLng: Double, targetLat: Double, targetLng: Double): Int {
    val latGap = kotlin.math.abs(myLat - targetLat) * 111.0
    val lngGap = kotlin.math.abs(myLng - targetLng) * 96.0
    return kotlin.math.sqrt(latGap * latGap + lngGap * lngGap).toInt()
}

@Composable
private fun rememberMapViewWithLifecycle(): MapView {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val mapView = remember { MapView(context) }
    DisposableEffect(lifecycle, mapView) {
        val observer = object : DefaultLifecycleObserver {
            override fun onResume(owner: LifecycleOwner) {
                mapView.onResume()
            }

            override fun onPause(owner: LifecycleOwner) {
                mapView.onPause()
            }

            override fun onDestroy(owner: LifecycleOwner) {
                mapView.onDestroy()
            }
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
        }
    }
    return mapView
}
