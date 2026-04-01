"use client";

import { create } from "zustand";

type VisitState = {
  radiusKm?: number;
  statusFilter: "all" | "visited" | "unvisited";
  setRadiusKm: (radiusKm?: number) => void;
  setStatusFilter: (status: "all" | "visited" | "unvisited") => void;
};

export const useVisitStore = create<VisitState>((set) => ({
  radiusKm: undefined,
  statusFilter: "all",
  setRadiusKm: (radiusKm) => set({ radiusKm }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
}));
