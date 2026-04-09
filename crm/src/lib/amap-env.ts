/**
 * 高德 Web 端配置，命名与 mobile/h5/src/components/VisitMap.tsx 完全一致：
 * NEXT_PUBLIC_AMAP_KEY、NEXT_PUBLIC_AMAP_SECURITY_JS_CODE
 */
export const AMAP_DEFAULT_KEY = "efdef4c613233f6e50b3f5f9ef48486b";

export function getAmapKey(): string {
  return process.env.NEXT_PUBLIC_AMAP_KEY || AMAP_DEFAULT_KEY;
}

export function getAmapSecurityJsCode(): string {
  return process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE ?? "";
}
