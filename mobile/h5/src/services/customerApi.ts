"use client";

import dayjs from "dayjs";
import type { Customer, CustomerQuery } from "@/types/customer";

let mockCustomers: Customer[] = [
  { id: "c001", name: "王倩", company: "京信贸易", address: "北京市朝阳区建国路88号", latitude: 39.90873, longitude: 116.45983, geocodeStatus: "SUCCESS", visitStatus: "UNVISITED" },
  { id: "c002", name: "李强", company: "北辰科技", address: "北京市海淀区中关村大街27号", latitude: 39.98342, longitude: 116.31534, geocodeStatus: "SUCCESS", visitStatus: "VISITED", visitedAt: "2026-03-31 15:20" },
  { id: "c003", name: "赵敏", company: "中关实业", address: "北京市海淀区西二旗大街39号", latitude: 40.04827, longitude: 116.30762, geocodeStatus: "SUCCESS", visitStatus: "UNVISITED" },
  { id: "c004", name: "孙涛", company: "顺达物流", address: "北京市通州区新华西街58号", latitude: 39.90716, longitude: 116.65721, geocodeStatus: "SUCCESS", visitStatus: "VISITED", visitedAt: "2026-04-01 09:40" },
  { id: "c005", name: "周琳", company: "京禾食品", address: "北京市丰台区南四环西路186号", latitude: 39.83588, longitude: 116.30489, geocodeStatus: "SUCCESS", visitStatus: "UNVISITED" },
  { id: "c006", name: "陈博", company: "安拓医药", address: "北京市大兴区荣华中路10号", latitude: 39.80177, longitude: 116.50046, geocodeStatus: "SUCCESS", visitStatus: "UNVISITED" },
  { id: "c007", name: "何静", company: "远景教育", address: "北京市西城区金融大街7号", latitude: 39.91495, longitude: 116.36193, geocodeStatus: "SUCCESS", visitStatus: "VISITED", visitedAt: "2026-03-29 14:05" },
  { id: "c008", name: "郭峰", company: "华北建材", address: "北京市石景山区阜石路158号", latitude: 39.91417, longitude: 116.18872, geocodeStatus: "SUCCESS", visitStatus: "UNVISITED" },
];

const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const latGap = Math.abs(lat1 - lat2) * 111;
  const lngGap = Math.abs(lng1 - lng2) * 96;
  return Math.sqrt(latGap * latGap + lngGap * lngGap);
};

export async function getCustomers(query: CustomerQuery = {}): Promise<Customer[]> {
  let list = [...mockCustomers];
  if (query.status === "visited") list = list.filter((c) => c.visitStatus === "VISITED");
  if (query.status === "unvisited") list = list.filter((c) => c.visitStatus === "UNVISITED");
  if (query.radiusKm && query.centerLat && query.centerLng) {
    list = list.filter((c) => {
      if (c.latitude == null || c.longitude == null) return false;
      return distanceKm(query.centerLat!, query.centerLng!, c.latitude, c.longitude) <= query.radiusKm!;
    });
  }
  return Promise.resolve(list);
}

export async function markVisited(customerId: string): Promise<Customer | undefined> {
  mockCustomers = mockCustomers.map((c) =>
    c.id === customerId
      ? { ...c, visitStatus: "VISITED", visitedAt: dayjs().format("YYYY-MM-DD HH:mm") }
      : c
  );
  return mockCustomers.find((c) => c.id === customerId);
}
