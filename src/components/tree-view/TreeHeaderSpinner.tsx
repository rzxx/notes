"use client";

import { useRootLoader } from "@/components/tree-view/hooks";
import { LoaderCircle } from "lucide-react";

export function TreeHeaderSpinner() {
  const { isFetchingRoot } = useRootLoader();

  return (
    <LoaderCircle
      size={16}
      strokeWidth={1.5}
      className={`animate-spin text-stone-500 transition-opacity duration-250 ease-out ${
        isFetchingRoot
          ? "opacity-100 [animation-play-state:running]"
          : "opacity-0 [animation-play-state:paused]"
      }`}
    />
  );
}
