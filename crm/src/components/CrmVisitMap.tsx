"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, App, Button, Card, Segmented, Select, Space, Tag } from "antd";
import { getAmapKey, getAmapSecurityJsCode } from "@/lib/amap-env";
import type { VisitMapPin } from "@/types/visit-map-pin";
import { useCrmVisitMapStore } from "@/store/crmVisitMapStore";
import styles from "./CrmVisitMap.module.css";

const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923];
const LOCATE_MSG_KEY = "crm-visit-map-locate";

const DEMO_REFERENCE_LNG = DEFAULT_CENTER[0];
const DEMO_REFERENCE_LAT = DEFAULT_CENTER[1];

const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const latGap = Math.abs(lat1 - lat2) * 111;
  const lngGap = Math.abs(lng1 - lng2) * 96;
  return Math.sqrt(latGap * latGap + lngGap * lngGap);
};

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

export default function CrmVisitMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [pins, setPins] = useState<VisitMapPin[]>([]);
  const [selected, setSelected] = useState<VisitMapPin | null>(null);
  const [myPosition, setMyPosition] = useState<{ lng: number; lat: number } | null>(null);
  const [locationHint, setLocationHint] = useState(false);
  /** 未配置安全密钥时的提示，可在浏览器内关闭并记住（仍建议在 .env.local 中配置） */
  const [amapSecurityHintDismissed, setAmapSecurityHintDismissed] = useState(false);

  const { radiusKm, statusFilter, setRadiusKm, setStatusFilter } = useCrmVisitMapStore();
  const { message } = App.useApp();

  const amapKey = getAmapKey();
  const amapSecurityJsCode = getAmapSecurityJsCode();
  const locateFailTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("crm_amap_security_hint_dismissed") === "1") {
        setAmapSecurityHintDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadPins = useCallback(async () => {
    const res = await fetch("/api/me/visit-map/pins");
    const data = (await res.json()) as { pins?: VisitMapPin[]; error?: string };
    if (!res.ok) {
      message.error(typeof data.error === "string" ? data.error : "加载客户失败");
      return;
    }
    setPins(data.pins ?? []);
  }, [message]);

  useEffect(() => {
    void loadPins();
  }, [loadPins]);

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
      "已使用演示参考点（北京天安门附近），可与客户点做距离筛选。真机外勤请用手机浏览器并允许定位。"
    );
  }, [message]);

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
          "仍未获取到位置。Mac/Safari 可能出现 kCLErrorLocationUnknown。可点「演示参考点」体验距离筛选。"
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
      }
    });

    tryBrowser(true);
  }, [message]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (typeof window === "undefined") return;
      /** 勿传空字符串：否则会触发 FlyDataAuthTask / INVALID_USER_SCODE；须与 Key 同应用下的安全密钥 */
      if (amapSecurityJsCode.trim()) {
        (window as unknown as { _AMapSecurityConfig?: { securityJsCode: string } })._AMapSecurityConfig = {
          securityJsCode: amapSecurityJsCode.trim(),
        };
      }

      const { default: AMapLoader } = await import("@amap/amap-jsapi-loader");
      const AMap = await AMapLoader.load({
        key: amapKey,
        version: "2.0",
        plugins: ["AMap.Geolocation", "AMap.Geocoder"],
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
    void init();
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
  }, [amapKey, amapSecurityJsCode, requestLocation, message]);

  useEffect(() => {
    if (!mapReady || myPosition) {
      setLocationHint(false);
      return;
    }
    const t = window.setTimeout(() => setLocationHint(true), 14_000);
    return () => window.clearTimeout(t);
  }, [mapReady, myPosition]);

  /** 地图容器尺寸变化时重绘（PC 放大后必须 resize） */
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInstanceRef.current;
    const el = mapRef.current;
    if (!map || !el) return;

    const resize = () => {
      try {
        map.resize();
      } catch {
        /* ignore */
      }
    };

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(resize);
    });
    ro.observe(el);
    window.addEventListener("resize", resize);
    resize();

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [mapReady]);

  const filteredPins = useMemo(() => {
    let list = [...pins];
    if (statusFilter === "visited") list = list.filter((p) => p.visitStatus === "VISITED");
    if (statusFilter === "unvisited") list = list.filter((p) => p.visitStatus === "UNVISITED");
    if (radiusKm && myPosition) {
      list = list.filter((p) => {
        if (p.latitude == null || p.longitude == null) return false;
        return distanceKm(myPosition.lat, myPosition.lng, p.latitude, p.longitude) <= radiusKm;
      });
    }
    return list;
  }, [pins, statusFilter, radiusKm, myPosition]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;
    const AMap = (window as unknown as { AMap?: any }).AMap;
    if (!AMap) return;

    markerRef.current.forEach((m) => map.remove(m));
    markerRef.current = [];

    filteredPins.forEach((c) => {
      if (c.latitude == null || c.longitude == null) return;
      const marker = new AMap.Marker({
        position: [c.longitude, c.latitude],
        title: c.name,
        icon:
          c.visitStatus === "VISITED"
            ? "https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png"
            : "https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png",
      });
      marker.on("click", () => setSelected(c));
      map.add(marker);
      markerRef.current.push(marker);
    });
  }, [filteredPins, mapReady]);

  const geocodeAttemptedRef = useRef<Set<number>>(new Set());

  /** 无坐标的地址：地理编码并写入 extraJson（与 mobile/h5 一致，数据落库） */
  useEffect(() => {
    if (!mapReady) return;
    const AMap = (window as unknown as { AMap?: any }).AMap;
    if (!AMap) return;

    const pending = pins.filter(
      (p) =>
        p.latitude == null &&
        p.longitude == null &&
        p.address?.trim() &&
        !geocodeAttemptedRef.current.has(p.id)
    );
    if (pending.length === 0) return;

    AMap.plugin(["AMap.Geocoder"], () => {
      const geocoder = new AMap.Geocoder({ city: "全国" });
      pending.forEach((pin) => {
        geocodeAttemptedRef.current.add(pin.id);
        geocoder.getLocation(pin.address, (status: string, result: any) => {
          if (status === "complete" && result?.geocodes?.[0]?.location) {
            const loc = result.geocodes[0].location;
            const lng = loc.lng as number;
            const lat = loc.lat as number;
            void fetch(`/api/me/enterprise-records/${pin.id}/map-position`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lng, lat }),
            }).then((res) => {
              if (res.ok) {
                setPins((prev) =>
                  prev.map((p) => (p.id === pin.id ? { ...p, longitude: lng, latitude: lat } : p))
                );
              }
            });
          }
        });
      });
    });
  }, [pins, mapReady]);

  const statusText = useMemo(
    () => (selected?.visitStatus === "VISITED" ? "已拜访" : "未拜访"),
    [selected]
  );

  const markVisited = async () => {
    if (!selected || selected.visitStatus === "VISITED") return;
    const res = await fetch(`/api/me/enterprise-records/${selected.id}/mark-visited`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mapLng: selected.longitude ?? undefined,
        mapLat: selected.latitude ?? undefined,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      message.error(typeof data.error === "string" ? data.error : "标记失败");
      return;
    }
    message.success("已标记为已拜访");
    setSelected({
      ...selected,
      visitStatus: "VISITED",
      visitedAt: new Date().toISOString(),
    });
    await loadPins();
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      {!amapSecurityJsCode && !amapSecurityHintDismissed && (
        <Alert
          type="warning"
          showIcon
          closable
          message="未配置高德安全密钥，地图底图可能为灰底"
          description="在控制台为「Web端(JS API)」Key 获取安全密钥，并在 .env.local 中设置 NEXT_PUBLIC_AMAP_SECURITY_JS_CODE（与 NEXT_PUBLIC_AMAP_KEY 同一应用）。"
          onClose={() => {
            try {
              sessionStorage.setItem("crm_amap_security_hint_dismissed", "1");
            } catch {
              /* ignore */
            }
            setAmapSecurityHintDismissed(true);
          }}
        />
      )}
      {locationHint && (
        <Alert
          type="info"
          showIcon
          message="尚未获取到当前位置，距离筛选需要定位"
          description="请允许浏览器位置权限。若仍失败，可使用「演示参考点」体验距离筛选。"
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
                演示参考点（北京）
              </Button>
            </Space>
          }
        />
      )}
      <div className={styles.controls}>
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
      </div>

      <div ref={mapRef} className={styles.mapPane} />

      {selected && (
        <Card title={selected.name}>
          <p>类别：{selected.company}</p>
          <p>地址：{selected.address || "—"}</p>
          <p>
            状态：
            <Tag color={selected.visitStatus === "VISITED" ? "blue" : "red"}>{statusText}</Tag>
          </p>
          {selected.visitStatus === "UNVISITED" && (
            <Button type="primary" onClick={() => void markVisited()}>
              标记为已拜访
            </Button>
          )}
        </Card>
      )}
    </Space>
  );
}
