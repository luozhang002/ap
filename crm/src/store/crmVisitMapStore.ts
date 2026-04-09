import { create } from "zustand";

type VisitMapState = {
  radiusKm?: number;
  statusFilter: "all" | "visited" | "unvisited";
  setRadiusKm: (radiusKm?: number) => void;
  setStatusFilter: (status: "all" | "visited" | "unvisited") => void;
};

export const useCrmVisitMapStore = create<VisitMapState>((set) => ({
  radiusKm: undefined,
  statusFilter: "all",
  setRadiusKm: (radiusKm) => set({ radiusKm }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
}));
