export type VisitStatus = "VISITED" | "UNVISITED";
export type GeocodeStatus = "SUCCESS" | "FAILED" | "PENDING";

export interface Customer {
  id: string;
  name: string;
  company: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  geocodeStatus: GeocodeStatus;
  visitStatus: VisitStatus;
  visitedAt?: string | null;
}

export interface CustomerQuery {
  status?: "visited" | "unvisited";
  radiusKm?: number;
  centerLat?: number;
  centerLng?: number;
}
