package com.ap.ap

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.tooling.preview.Preview
import com.amap.api.maps.MapsInitializer
import com.ap.ap.data.CustomerRepository
import com.ap.ap.data.CustomerQuery
import com.ap.ap.data.VisitApiService
import com.ap.ap.model.Customer
import com.ap.ap.model.VisitStatus
import com.ap.ap.ui.VisitMapScreen
import com.ap.ap.ui.theme.ApTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MapsInitializer.updatePrivacyShow(this, true, true)
        MapsInitializer.updatePrivacyAgree(this, true)
        enableEdgeToEdge()
        setContent {
            ApTheme {
                VisitApp()
            }
        }
    }
}

@Composable
private fun VisitApp() {
    val repository = remember { CustomerRepository() }
    // TODO(api): 当前为模拟服务，后续替换为真实远程数据源（Repository + Retrofit）。
    val api = remember { VisitApiService(repository) }
    val customers = remember { mutableStateListOf<Customer>().apply { addAll(api.getCustomers(CustomerQuery())) } }
    var showMap by rememberSaveable { mutableStateOf(false) }

    Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
        if (showMap) {
            VisitMapScreen(
                customers = customers.toList(),
                onBack = { showMap = false },
                onMarkVisited = { customerId ->
                    // TODO(api): 这里后续传入真实 operatorId、定位坐标与唯一幂等键。
                    val updated = api.markVisited(
                        customerId = customerId,
                        operatorId = "sales_manager_001",
                        clientLat = null,
                        clientLng = null,
                        idempotencyKey = "visit-$customerId"
                    )
                    replaceCustomer(customers, updated)
                }
            )
        } else {
            CustomerListScreen(
                customers = customers.toList(),
                contentPadding = innerPadding,
                onOpenMap = { showMap = true }
            )
        }
    }
}

private fun replaceCustomer(customers: MutableList<Customer>, updated: Customer?) {
    if (updated == null) return
    val index = customers.indexOfFirst { it.id == updated.id }
    if (index != -1) {
        customers[index] = updated
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CustomerListScreen(
    customers: List<Customer>,
    contentPadding: PaddingValues,
    onOpenMap: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(contentPadding)
    ) {
        TopAppBar(
            title = { Text("客户列表") },
            actions = {
                Button(
                    modifier = Modifier.padding(end = 12.dp),
                    onClick = onOpenMap
                ) {
                    Text("拜访地图")
                }
            }
        )
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(customers, key = { it.id }) { customer ->
                CustomerCard(customer = customer)
            }
        }
    }
}

@Composable
private fun CustomerCard(customer: Customer) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors()
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("姓名：${customer.name}")
            Text("公司：${customer.company}")
            Text("地址：${customer.address}")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "状态：${if (customer.visitStatus == VisitStatus.VISITED) "已拜访" else "未拜访"}"
                )
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun VisitAppPreview() {
    ApTheme {
        VisitApp()
    }
}