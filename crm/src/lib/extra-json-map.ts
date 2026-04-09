import type { Prisma } from "@prisma/client";

/** extraJson 中缓存的高德坐标；兼容 mapLng/mapLat 与 h5 Customer 风格的 longitude/latitude */
export function parseMapCoordsFromExtra(extra: Prisma.JsonValue | null): {
  lng: number;
  lat: number;
} | null {
  if (extra === null || extra === undefined) return null;
  if (typeof extra !== "object" || Array.isArray(extra)) return null;
  const o = extra as Record<string, unknown>;
  const lng = toNum(o.mapLng ?? o.lng ?? o.longitude);
  const lat = toNum(o.mapLat ?? o.lat ?? o.latitude);
  if (lng === null || lat === null) return null;
  return { lng, lat };
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function mergeExtraJsonMapPosition(
  current: Prisma.JsonValue | null,
  lng: number,
  lat: number
): Prisma.InputJsonValue {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};
  /** 与 h5 Customer 字段名一致，便于两端共用 extraJson */
  return {
    ...base,
    mapLng: lng,
    mapLat: lat,
    longitude: lng,
    latitude: lat,
  } as Prisma.InputJsonValue;
}
