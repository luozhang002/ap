package com.ap.ap.data

import com.ap.ap.model.Customer
import com.ap.ap.model.GeocodeStatus
import com.ap.ap.model.VisitStatus
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

class CustomerRepository {
    private val customers = GeocodeBatchService().enrichCoordinates(
        listOf(
        Customer(
            id = "c001",
            name = "王倩",
            company = "京信贸易",
            address = "北京市朝阳区建国路88号",
            latitude = 39.90873,
            longitude = 116.45983,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.UNVISITED
        ),
        Customer(
            id = "c002",
            name = "李强",
            company = "北辰科技",
            address = "北京市海淀区中关村大街27号",
            latitude = 39.98342,
            longitude = 116.31534,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.VISITED,
            visitedAt = "2026-03-31 15:20"
        ),
        Customer(
            id = "c003",
            name = "赵敏",
            company = "中关实业",
            address = "北京市海淀区西二旗大街39号",
            latitude = 40.04827,
            longitude = 116.30762,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.UNVISITED
        ),
        Customer(
            id = "c004",
            name = "孙涛",
            company = "顺达物流",
            address = "北京市通州区新华西街58号",
            latitude = 39.90716,
            longitude = 116.65721,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.VISITED,
            visitedAt = "2026-04-01 09:40"
        ),
        Customer(
            id = "c005",
            name = "周琳",
            company = "京禾食品",
            address = "北京市丰台区南四环西路186号",
            latitude = 39.83588,
            longitude = 116.30489,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.UNVISITED
        ),
        Customer(
            id = "c006",
            name = "陈博",
            company = "安拓医药",
            address = "北京市大兴区荣华中路10号",
            latitude = 39.80177,
            longitude = 116.50046,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.UNVISITED
        ),
        Customer(
            id = "c007",
            name = "何静",
            company = "远景教育",
            address = "北京市西城区金融大街7号",
            latitude = 39.91495,
            longitude = 116.36193,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.VISITED,
            visitedAt = "2026-03-29 14:05"
        ),
        Customer(
            id = "c008",
            name = "郭峰",
            company = "华北建材",
            address = "北京市石景山区阜石路158号",
            latitude = 39.91417,
            longitude = 116.18872,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.UNVISITED
        ),
        Customer(
            id = "c009",
            name = "宋楠",
            company = "首都文创",
            address = "北京市东城区东直门南大街11号",
            latitude = 39.94687,
            longitude = 116.43467,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.VISITED,
            visitedAt = "2026-03-30 10:12"
        ),
        Customer(
            id = "c010",
            name = "高原",
            company = "国贸商服",
            address = "北京市朝阳区光华路1号",
            latitude = 39.91355,
            longitude = 116.46004,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.UNVISITED
        ),
        Customer(
            id = "c011",
            name = "马琳",
            company = "燕京汽车",
            address = "北京市顺义区后沙峪安平街3号",
            latitude = 40.10892,
            longitude = 116.55649,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.VISITED,
            visitedAt = "2026-03-28 16:48"
        ),
        Customer(
            id = "c012",
            name = "吴凯",
            company = "新源能源",
            address = "北京市昌平区回龙观西大街118号",
            latitude = 40.07196,
            longitude = 116.35152,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.UNVISITED
        ),
        Customer(
            id = "c013",
            name = "唐悦",
            company = "瑞合咨询",
            address = "北京市朝阳区望京街10号",
            latitude = 39.99731,
            longitude = 116.47018,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.UNVISITED
        ),
        Customer(
            id = "c014",
            name = "郑超",
            company = "金桥供应链",
            address = "北京市房山区长阳镇怡和北路5号",
            latitude = 39.76439,
            longitude = 116.13983,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.VISITED,
            visitedAt = "2026-03-27 11:26"
        ),
        Customer(
            id = "c015",
            name = "戴薇",
            company = "博联传媒",
            address = "北京市朝阳区酒仙桥北路9号",
            latitude = 39.97664,
            longitude = 116.49877,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.UNVISITED
        ),
        Customer(
            id = "c016",
            name = "潘磊",
            company = "云启软件",
            address = "北京市海淀区上地十街1号",
            latitude = 40.04801,
            longitude = 116.31027,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.VISITED,
            visitedAt = "2026-04-01 08:55"
        ),
        Customer(
            id = "c017",
            name = "许晨",
            company = "新航零售",
            address = "北京市朝阳区三里屯路19号",
            latitude = 39.93677,
            longitude = 116.45532,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.UNVISITED
        ),
        Customer(
            id = "c018",
            name = "林菲",
            company = "智达医疗",
            address = "北京市海淀区学院路37号",
            latitude = 39.99142,
            longitude = 116.35749,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.UNVISITED
        ),
        Customer(
            id = "c019",
            name = "彭涛",
            company = "优品家居",
            address = "北京市朝阳区十里堡甲3号",
            latitude = 39.92758,
            longitude = 116.51447,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.VISITED,
            visitedAt = "2026-03-30 17:35"
        ),
        Customer(
            id = "c020",
            name = "韩雪",
            company = "北方会展",
            address = "北京市朝阳区北辰东路8号",
            latitude = 40.00114,
            longitude = 116.39259,
            geocodeStatus = GeocodeStatus.SUCCESS,
            visitStatus = VisitStatus.UNVISITED
        ),
        Customer(
            id = "c021",
            name = "段宁",
            company = "诚联实业",
            address = "北京市门头沟区新桥南大街5号",
            latitude = null,
            longitude = null,
            geocodeStatus = GeocodeStatus.FAILED,
            visitStatus = VisitStatus.UNVISITED
        ),
        Customer(
            id = "c022",
            name = "罗然",
            company = "华东机电北京分部",
            address = "北京市延庆区妫水南街28号",
            latitude = null,
            longitude = null,
            geocodeStatus = GeocodeStatus.PENDING,
            visitStatus = VisitStatus.UNVISITED
        )
    )).toMutableList()

    fun loadCustomers(): List<Customer> = customers.toList()

    fun markVisited(customerId: String): Customer? {
        val index = customers.indexOfFirst { it.id == customerId }
        if (index == -1) return null
        val old = customers[index]
        if (old.visitStatus == VisitStatus.VISITED) return old

        val now = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
        val updated = old.copy(
            visitStatus = VisitStatus.VISITED,
            visitedAt = now
        )
        customers[index] = updated
        return updated
    }
}
