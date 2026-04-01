"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Segmented, Select, Space, Tag } from "antd";
import type { Customer } from "@/types/customer";
import { useVisitStore } from "@/store/visitStore";
import { getCustomers, markVisited } from "@/services/customerApi";

const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923];

export default function VisitMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [myPosition, setMyPosition] = useState<{ lng: number; lat: number } | null>(null);

  const { radiusKm, statusFilter, setRadiusKm, setStatusFilter } = useVisitStore();

  const amapKey = process.env.NEXT_PUBLIC_AMAP_KEY || "efdef4c613233f6e50b3f5f9ef48486b";
  // 高德 JS API 2.0 必须配置安全密钥，否则瓦片不加载（灰底网格）。控制台「应用」→「密钥」里与 Key 配套的安全密钥。
  const amapSecurityJsCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE ?? "";

  useEffect(() => {
    const init = async () => {
      if (typeof window === "undefined") return;
      (window as unknown as { _AMapSecurityConfig?: { securityJsCode: string } })._AMapSecurityConfig = {
        securityJsCode: amapSecurityJsCode,
      };

      const { default: AMapLoader } = await import("@amap/amap-jsapi-loader");
      const AMap = await AMapLoader.load({
        key: amapKey,
        version: "2.0",
        plugins: ["AMap.Geolocation"],
      });

      if (!mapRef.current || mapInstanceRef.current) return;
      const map = new AMap.Map(mapRef.current, { zoom: 11, center: DEFAULT_CENTER, resizeEnable: true });
      mapInstanceRef.current = map;

      const geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 8000 });
      map.addControl(geolocation);
      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === "complete" && result?.position) {
          const pos = { lng: result.position.lng, lat: result.position.lat };
          setMyPosition(pos);
          map.setCenter([pos.lng, pos.lat]);
        }
      });
    };
    init();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, [amapKey, amapSecurityJsCode]);

  useEffect(() => {
    const load = async () => {
      const status =
        statusFilter === "all" ? undefined : (statusFilter as "visited" | "unvisited");
      const list = await getCustomers({
        status,
        radiusKm,
        centerLat: myPosition?.lat,
        centerLng: myPosition?.lng,
      });
      setCustomers(list);
    };
    load();
  }, [statusFilter, radiusKm, myPosition]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const AMap = (window as any).AMap;
    if (!AMap) return;

    markerRef.current.forEach((m) => map.remove(m));
    markerRef.current = [];

    customers.forEach((c) => {
      if (c.latitude == null || c.longitude == null) return;
      const marker = new AMap.Marker({
        position: [c.longitude, c.latitude],
        title: c.name,
        icon:
          c.visitStatus === "VISITED"
            ? "https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png"
            : "https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png",
      });
      marker.on("click", () => setSelectedCustomer(c));
      map.add(marker);
      markerRef.current.push(marker);
    });
  }, [customers]);

  const statusText = useMemo(
    () => (selectedCustomer?.visitStatus === "VISITED" ? "已拜访" : "未拜访"),
    [selectedCustomer]
  );

  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={12}>
      {!amapSecurityJsCode && (
        <Alert
          type="warning"
          showIcon
          message="未配置高德安全密钥，地图底图可能为灰底"
          description="在控制台为「Web端(JS API)」Key 获取安全密钥，并在 mobile/h5/.env.local 中设置 NEXT_PUBLIC_AMAP_SECURITY_JS_CODE。需与 NEXT_PUBLIC_AMAP_KEY 为同一应用。"
        />
      )}
      <Space wrap>
        <Segmented
          options={[
            { label: "全部", value: "all" },
            { label: "未拜访", value: "unvisited" },
            { label: "已拜访", value: "visited" },
          ]}
          value={statusFilter}
          onChange={(val) => setStatusFilter(val as "all" | "visited" | "unvisited")}
        />
        <Select
          style={{ width: 130 }}
          value={radiusKm}
          placeholder="距离筛选"
          allowClear
          onChange={(v) => setRadiusKm(v)}
          options={[
            { label: "1km", value: 1 },
            { label: "3km", value: 3 },
            { label: "5km", value: 5 },
            { label: "10km", value: 10 },
          ]}
        />
      </Space>

      <div ref={mapRef} style={{ width: "100%", height: 420, borderRadius: 12, overflow: "hidden" }} />

      {selectedCustomer && (
        <Card title={selectedCustomer.name}>
          <p>公司：{selectedCustomer.company}</p>
          <p>地址：{selectedCustomer.address}</p>
          <p>
            状态：
            <Tag color={selectedCustomer.visitStatus === "VISITED" ? "red" : "blue"}>{statusText}</Tag>
          </p>
          {selectedCustomer.visitStatus === "UNVISITED" && (
            <Button
              type="primary"
              onClick={async () => {
                const updated = await markVisited(selectedCustomer.id);
                if (!updated) return;
                setSelectedCustomer(updated);
                const refreshed = await getCustomers({
                  status: statusFilter === "all" ? undefined : statusFilter,
                  radiusKm,
                  centerLat: myPosition?.lat,
                  centerLng: myPosition?.lng,
                });
                setCustomers(refreshed);
              }}
            >
              标记为已拜访
            </Button>
          )}
        </Card>
      )}
    </Space>
  );
}
