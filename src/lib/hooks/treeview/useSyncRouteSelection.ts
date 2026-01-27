"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTreeStore } from "@/lib/stores/tree";

export function useSyncRouteSelection() {
  const routeParams = useParams<{ id?: string }>();
  const routeSelectedId = typeof routeParams?.id === "string" ? routeParams.id : undefined;
  const selectedId = useTreeStore((state) => state.selectedId);
  const select = useTreeStore((state) => state.select);
  const clearSelection = useTreeStore((state) => state.clearSelection);

  React.useEffect(() => {
    if (routeSelectedId) {
      if (routeSelectedId !== selectedId) select(routeSelectedId);
      return;
    }

    if (selectedId !== null) clearSelection();
  }, [clearSelection, routeSelectedId, select, selectedId]);
}
