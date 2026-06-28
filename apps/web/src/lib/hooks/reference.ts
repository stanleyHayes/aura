"use client";

import { useQuery } from "@tanstack/react-query";
import type { Building, Department, Equipment } from "@cbs/schemas";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";

export function useBuildings() {
  return useQuery({
    queryKey: qk.buildings,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Building[]> => {
      const page = unwrap(
        await api.GET("/api/v1/buildings", {
          params: { query: { limit: 200 } },
        }),
      );
      return page.data as Building[];
    },
  });
}

export function useEquipment() {
  return useQuery({
    queryKey: qk.equipment,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Equipment[]> => {
      const page = unwrap(
        await api.GET("/api/v1/equipment", {
          params: { query: { limit: 200 } },
        }),
      );
      return page.data as Equipment[];
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: qk.departments,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Department[]> => {
      const page = unwrap(
        await api.GET("/api/v1/departments", {
          params: { query: { limit: 200 } },
        }),
      );
      return page.data as Department[];
    },
  });
}
