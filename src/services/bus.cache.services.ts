import type { Bus } from "../types/bus.js";

type CacheStatus = "loading" | "ready" | "error";

type BusCache = {
  buses: Bus[];
  status: CacheStatus;
  lastUpdate: Date | null;
};

const cache: BusCache = {
  buses: [],
  status: "loading",
  lastUpdate: null,
};

export function getBusCache(): BusCache {
  return cache;
}

export function updateBusCache(bueses: Bus[]): void {
  cache.buses = bueses;
  cache.status = "ready";
  cache.lastUpdate = new Date();
}

export function setBusCacheError(): void {
  cache.status = "error";
}
