export type VisitMapPin = {
  id: number;
  name: string;
  company: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  visitStatus: "VISITED" | "UNVISITED";
  visitedAt?: string | null;
  region: string | null;
  district: string | null;
};
