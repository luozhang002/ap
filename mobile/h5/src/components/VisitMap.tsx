"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Segmented, Select, Space, Tag, message } from "antd";
import type { Customer } from "@/types/customer";
import { useVisitStore } from "@/store/visitStore";
import { getCustomers, markVisited } from "@/services/customerApi";

const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923];
const LOCATE_MSG_KEY = "visit-map-locate";

/** 与 mock 客户同属北京地区，用于开发/桌面 Safari 等无法拿到 GPS 时的距离筛选参考点 */
const DEMO_REFERENCE_LNG = DEFAULT_CENTER[0];
const DEMO_REFERENCE_LAT = DEFAULT_CENTER[1];

function applyMyLocation(
  map: any,
  AMap: any,
  lng: number,
  lat: number,
  userMarkerRef: MutableRefObject<any | null>,
  setMyPosition: Dispatch<SetStateAction<{ lng: number; lat: number } | null>>
) {
  setMyPosition({ lng, lat });
  map.setCenter([lng, lat]);
  if (userMarkerRef.current) {
    try {
      map.remove(userMarkerRef.current);
    } catch {
      /* ignore */
    }
    userMarkerRef.current = null;
  }
  userMarkerRef.current = new AMap.Marker({
    position: [lng, lat],
    zIndex: 200,
    anchor: "center",
    content:
      '<div style="width:14px;height:14px;background:#1677ff;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
  });
  map.add(userMarkerRef.current);
}

export default function VisitMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [myPosition, setMyPosition] = useState<{ lng: number; lat: number } | null>(null);
  const [locationHint, setLocationHint] = useState(false);

  const { radiusKm, statusFilter, setRadiusKm, setStatusFilter } = useVisitStore();

  const amapKey = process.env.NEXT_PUBLIC_AMAP_KEY || "efdef4c613233f6e50b3f5f9ef48486b";
  // 高德 JS API 2.0 必须配置安全密钥，否则瓦片不加载（灰底网格）。控制台「应用」→「密钥」里与 Key 配套的安全密钥。
  const amapSecurityJsCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE ?? "";
  const locateFailTimerRef = useRef<number | null>(null);

  /** 桌面 Safari/macOS 常报 CoreLocation kCLErrorLocationUnknown，与演示数据对齐的兜底参考点 */
  const applyDemoReferenceLocation = useCallback(() => {
    const map = mapInstanceRef.current;
    const AMap = typeof window !== "undefined" ? (window as unknown as { AMap?: any }).AMap : undefined;
    if (!map || !AMap) {
      message.warning("地图尚未加载完成");
      return;
    }
    if (locateFailTimerRef.current != null) {
      window.clearTimeout(locateFailTimerRef.current);
      locateFailTimerRef.current = null;
    }
    message.destroy(LOCATE_MSG_KEY);
    applyMyLocation(map, AMap, DEMO_REFERENCE_LNG, DEMO_REFERENCE_LAT, userMarkerRef, setMyPosition);
    setLocationHint(false);
    message.success(
      "已使用演示参考点（北京天安门附近），可与示例客户做距离筛选。真机外勤请用手机浏览器并允许定位。"
    );
  }, []);

  /** 每次调用新建 Geolocation（挂在地图上的控件实例重复 getCurrentPosition 可能不再回调）。点击「重新定位」走此逻辑。 */
  const requestLocation = useCallback(() => {
    const map = mapInstanceRef.current;
    const AMap = typeof window !== "undefined" ? (window as unknown as { AMap?: any }).AMap : undefined;
    if (!map || !AMap) {
      message.warning("地图尚未加载完成，请稍后再试");
      return;
    }

    if (locateFailTimerRef.current != null) {
      window.clearTimeout(locateFailTimerRef.current);
      locateFailTimerRef.current = null;
    }

    const mapSnapshot = map;
    let located = false;
    const amapSucceeded = { current: false };

    const onLocated = () => {
      located = true;
      if (locateFailTimerRef.current != null) {
        window.clearTimeout(locateFailTimerRef.current);
        locateFailTimerRef.current = null;
      }
      message.destroy(LOCATE_MSG_KEY);
      setLocationHint(false);
    };

    message.loading({ content: "正在定位…", duration: 0, key: LOCATE_MSG_KEY });
    locateFailTimerRef.current = window.setTimeout(() => {
      locateFailTimerRef.current = null;
      message.destroy(LOCATE_MSG_KEY);
      if (!located) {
        message.warning(
          "仍未获取到位置。Mac/Safari 可能出现 kCLErrorLocationUnknown（室内/Wi‑Fi 定位不可用）。可点提示条里的「演示参考点」先做距离筛选。"
        );
      }
    }, 16_000);

    const tryBrowser = (highAccuracy: boolean) => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (mapInstanceRef.current !== mapSnapshot || amapSucceeded.current) return;
          applyMyLocation(
            mapSnapshot,
            AMap,
            pos.coords.longitude,
            pos.coords.latitude,
            userMarkerRef,
            setMyPosition
          );
          onLocated();
        },
        () => {
          if (highAccuracy) {
            tryBrowser(false);
          }
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: 15_000,
          maximumAge: highAccuracy ? 0 : 300_000,
        }
      );
    };

    const geo = new AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 15_000,
      showMarker: false,
      showCircle: false,
      showButton: false,
    });

    geo.getCurrentPosition((status: string, result: any) => {
      if (mapInstanceRef.current !== mapSnapshot) return;
      if (status === "complete" && result?.position) {
        amapSucceeded.current = true;
        const { lng, lat } = result.position;
        applyMyLocation(mapSnapshot, AMap, lng, lat, userMarkerRef, setMyPosition);
        onLocated();
        return;
      }
      // 浏览器定位已在下方并行发起，此处无需再调
    });

    tryBrowser(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

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

      if (cancelled || !mapRef.current || mapInstanceRef.current) return;
      const map = new AMap.Map(mapRef.current, { zoom: 11, center: DEFAULT_CENTER, resizeEnable: true });
      if (cancelled || !mapRef.current) {
        map.destroy();
        return;
      }
      mapInstanceRef.current = map;
      setMapReady(true);

      const geolocationControl = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 15_000,
        showMarker: false,
        showCircle: false,
        showButton: true,
      });
      map.addControl(geolocationControl);

      if (!cancelled) {
        requestLocation();
      }
    };
    init();
    return () => {
      cancelled = true;
      if (locateFailTimerRef.current != null) {
        window.clearTimeout(locateFailTimerRef.current);
        locateFailTimerRef.current = null;
      }
      message.destroy(LOCATE_MSG_KEY);
      setMapReady(false);
      const m = mapInstanceRef.current;
      if (m) {
        markerRef.current.forEach((mk) => {
          try {
            m.remove(mk);
          } catch {
            /* ignore */
          }
        });
        markerRef.current = [];
        if (userMarkerRef.current) {
          try {
            m.remove(userMarkerRef.current);
          } catch {
            /* ignore */
          }
          userMarkerRef.current = null;
        }
        m.destroy();
      }
      mapInstanceRef.current = null;
    };
  }, [amapKey, amapSecurityJsCode, requestLocation]);

  useEffect(() => {
    if (!mapReady || myPosition) {
      setLocationHint(false);
      return;
    }
    const t = window.setTimeout(() => setLocationHint(true), 14_000);
    return () => window.clearTimeout(t);
  }, [mapReady, myPosition]);

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
    if (!map || !mapReady) return;
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
  }, [customers, mapReady]);

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
          title="未配置高德安全密钥，地图底图可能为灰底"
          description="在控制台为「Web端(JS API)」Key 获取安全密钥，并在 mobile/h5/.env.local 中设置 NEXT_PUBLIC_AMAP_SECURITY_JS_CODE。需与 NEXT_PUBLIC_AMAP_KEY 为同一应用。"
        />
      )}
      {locationHint && (
        <Alert
          type="info"
          showIcon
          title="尚未获取到当前位置，距离筛选需要定位"
          description={
            <>
              请允许浏览器位置权限，并尽量开启 Wi‑Fi（桌面 Safari 依赖 CoreLocation，室内常出现
              kCLErrorLocationUnknown）。若仍失败，可使用与示例客户同区域的「演示参考点」体验距离筛选。
            </>
          }
          action={
            <Space size={8} wrap>
              <Button
                size="small"
                type="primary"
                htmlType="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  requestLocation();
                }}
              >
                重新定位
              </Button>
              <Button
                size="small"
                htmlType="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  applyDemoReferenceLocation();
                }}
              >
                使用演示参考点（北京）
              </Button>
            </Space>
          }
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
