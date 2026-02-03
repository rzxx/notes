"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { selectFlatRows, useTreeStore } from "@/lib/stores/tree";
import { useMoveNote } from "@/lib/hooks/mutations/useMoveNote";
import { TreeRow } from "@/components/tree-view/TreeRow";
import { useSyncRouteSelection } from "@/components/tree-view/hooks";
import { TreeDragOverlayRow } from "@/components/tree-view/TreeDragOverlayRow";
import type { DropPosition, DropTarget } from "@/components/tree-view/tree-dnd-types";

const ROOT_DROP_ID = "tree-root";

const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  const hits = pointerHits.length ? pointerHits : rectIntersection(args);
  const nonRoot = hits.filter((hit) => hit.id !== ROOT_DROP_ID);
  return nonRoot.length ? nonRoot : hits;
};

const getDropPosition = (
  pointer: { x: number; y: number } | null,
  overRect: { top: number; height: number; left: number; width: number } | null,
  depth: number,
  titleWidth: number,
): DropPosition => {
  if (!pointer || !overRect) return "inside";
  const centerY = pointer.y;
  const centerX = pointer.x;
  const topEdge = overRect.top + overRect.height * 0.3;
  const bottomEdge = overRect.top + overRect.height * 0.7;
  const insideZoneWidth = Math.min(overRect.width * 0.5, titleWidth);
  const insideZoneLeft = overRect.left + depth * 12 + 24;
  const insideZoneRight = insideZoneLeft + insideZoneWidth;
  const allowInside = centerX >= insideZoneLeft && centerX <= insideZoneRight;
  if (allowInside) return "inside";
  if (centerY < topEdge) return "before";
  if (centerY > bottomEdge) return "after";
  return centerY < overRect.top + overRect.height / 2 ? "before" : "after";
};

const getPointerDepth = (
  pointer: { x: number; y: number } | null,
  overRect: { top: number; height: number; left: number; width: number } | null,
) => {
  if (!pointer || !overRect) return null;
  const baseLeft = overRect.left + 24;
  const rawDepth = Math.round((pointer.x - baseLeft) / 12);
  return Math.max(0, rawDepth);
};

type GroupEndMarker = { parentId: string | null; afterId: string; depth: number };

const pickGroupEndMarker = (
  markers: GroupEndMarker[],
  desiredDepth: number,
): GroupEndMarker | null => {
  let chosen: GroupEndMarker | null = null;
  let closest = Number.POSITIVE_INFINITY;
  markers.forEach((marker) => {
    const diff = Math.abs(marker.depth - desiredDepth);
    if (diff < closest) {
      chosen = marker;
      closest = diff;
    }
  });
  return chosen;
};

const isDescendant = (
  ancestorId: string,
  candidateId: string | null,
  meta: ReturnType<typeof useTreeStore.getState>["meta"],
) => {
  if (!candidateId) return false;
  const stack = [...(meta[ancestorId]?.childrenIds ?? [])];
  while (stack.length) {
    const next = stack.pop();
    if (!next) continue;
    if (next === candidateId) return true;
    const nextChildren = meta[next]?.childrenIds ?? [];
    stack.push(...nextChildren);
  }
  return false;
};

export function TreeScrollableContent() {
  const rows = useTreeStore(selectFlatRows);
  const nodes = useTreeStore((state) => state.nodes);
  const meta = useTreeStore((state) => state.meta);
  const toggleExpanded = useTreeStore((state) => state.toggleExpanded);
  const moveNote = useMoveNote();
  const moveNodeWithSnapshot = useTreeStore((state) => state.moveNodeWithSnapshot);

  useSyncRouteSelection();

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null);
  const [collapsedSnapshot, setCollapsedSnapshot] = React.useState<{
    id: string;
    wasExpanded: boolean;
  } | null>(null);
  const dragStartPointerRef = React.useRef<{ x: number; y: number } | null>(null);
  const didDragRef = React.useRef(false);

  const { setNodeRef: setRootDropRef } = useDroppable({ id: ROOT_DROP_ID });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 120,
        tolerance: 4,
        distance: 6,
      },
    }),
  );

  const activeRowDepth = React.useMemo(() => {
    if (!activeId) return 0;
    const row = rows.find((item) => item.kind === "node" && item.id === activeId);
    return row?.depth ?? 0;
  }, [activeId, rows]);

  const isSameDropTarget = React.useCallback((a: DropTarget | null, b: DropTarget | null) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return (
      a.overId === b.overId &&
      a.position === b.position &&
      a.newParentId === b.newParentId &&
      a.beforeId === b.beforeId &&
      a.afterId === b.afterId &&
      a.indicatorDepth === b.indicatorDepth
    );
  }, []);

  const getPointerFromEvent = React.useCallback((event: Event) => {
    const touchEvent = event as TouchEvent;
    if (typeof touchEvent.touches !== "undefined") {
      const touch = touchEvent.touches[0] ?? touchEvent.changedTouches[0];
      return touch ? { x: touch.clientX, y: touch.clientY } : null;
    }
    const mouseEvent = event as MouseEvent;
    if (typeof mouseEvent.clientX === "number" && typeof mouseEvent.clientY === "number") {
      return { x: mouseEvent.clientX, y: mouseEvent.clientY };
    }
    return null;
  }, []);

  const updateDropTarget = React.useCallback(
    (event: DragMoveEvent | DragOverEvent) => {
      if (!activeId || !event.over) {
        setDropTarget((prev) => (prev ? null : prev));
        return;
      }

      const overId = String(event.over.id);
      if (overId === ROOT_DROP_ID) {
        const nextTarget = {
          overId,
          position: "after" as const,
          newParentId: null,
          beforeId: null,
          afterId: null,
        };
        setDropTarget((prev) => (isSameDropTarget(prev, nextTarget) ? prev : nextTarget));
        return;
      }

      const overData = event.over.data.current as
        | {
            kind?: "node";
            depth?: number;
            titleWidth?: number;
            parentId?: string | null;
            isExpanded?: boolean;
            hasChildren?: boolean;
            firstChildId?: string | null;
            groupEndMarkers?: GroupEndMarker[];
          }
        | undefined;

      if (!overData) {
        setDropTarget((prev) => (prev ? null : prev));
        return;
      }

      if (overData.kind !== "node") {
        setDropTarget((prev) => (prev ? null : prev));
        return;
      }

      const overRect = event.over.rect ?? null;
      const overDepth = overData.depth ?? 0;
      const startPointer = dragStartPointerRef.current;
      const pointer = startPointer
        ? { x: startPointer.x + event.delta.x, y: startPointer.y + event.delta.y }
        : null;
      const titleWidth = overData.titleWidth ?? 160;
      const position = getDropPosition(pointer, overRect, overDepth, titleWidth);

      if (overId === activeId) {
        setDropTarget((prev) => (prev ? null : prev));
        return;
      }

      let nextPosition = position;
      let forcedBeforeId: string | null = null;
      if (position === "after" && overData.isExpanded && overData.hasChildren) {
        nextPosition = "inside";
        forcedBeforeId = overData.firstChildId ?? null;
      }
      const rowDepth = overData.depth ?? 0;
      let indicatorDepth = rowDepth;
      let newParentId = nextPosition === "inside" ? overId : (overData.parentId ?? null);
      let beforeId = nextPosition === "before" ? overId : forcedBeforeId;
      let afterId = nextPosition === "after" ? overId : null;

      if (nextPosition === "after") {
        const pointerDepth = getPointerDepth(pointer, overRect);
        const markers: GroupEndMarker[] = overData.groupEndMarkers ?? [];
        if (pointerDepth !== null && pointerDepth < rowDepth && markers.length) {
          const marker = pickGroupEndMarker(markers, pointerDepth);
          if (marker) {
            const selected = marker as GroupEndMarker;
            newParentId = selected.parentId;
            afterId = selected.afterId;
            beforeId = null;
            indicatorDepth = selected.depth;
          }
        }
      }

      if (newParentId === activeId) {
        setDropTarget((prev) => (prev ? null : prev));
        return;
      }

      if (isDescendant(activeId, newParentId, meta)) {
        setDropTarget((prev) => (prev ? null : prev));
        return;
      }

      const nextTarget = {
        overId,
        position: nextPosition,
        newParentId,
        beforeId,
        afterId,
        indicatorDepth,
      };
      setDropTarget((prev) => (isSameDropTarget(prev, nextTarget) ? prev : nextTarget));
    },
    [activeId, isSameDropTarget, meta],
  );

  const parentHighlightId =
    dropTarget && dropTarget.position !== "inside" ? dropTarget.newParentId : null;

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const nextId = String(event.active.id);
      setActiveId(nextId);
      setDropTarget(null);
      didDragRef.current = true;
      dragStartPointerRef.current = getPointerFromEvent(event.activatorEvent);

      const wasExpanded = meta[nextId]?.isExpanded ?? false;
      if (wasExpanded) {
        toggleExpanded(nextId, false);
        setCollapsedSnapshot({ id: nextId, wasExpanded });
      } else {
        setCollapsedSnapshot({ id: nextId, wasExpanded: false });
      }
    },
    [getPointerFromEvent, meta, toggleExpanded],
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      if (collapsedSnapshot?.wasExpanded) {
        toggleExpanded(collapsedSnapshot.id, true);
      }

      const nextActiveId = String(event.active.id);

      if (dropTarget && nextActiveId) {
        const previousParentId = nodes[nextActiveId]?.parentId ?? null;
        const snapshot = moveNodeWithSnapshot(nextActiveId, dropTarget.newParentId ?? null, {
          beforeId: dropTarget.beforeId ?? null,
          afterId: dropTarget.afterId ?? null,
        });
        moveNote.mutate({
          noteId: nextActiveId,
          newParentId: dropTarget.newParentId ?? null,
          previousParentId,
          beforeId: dropTarget.beforeId ?? null,
          afterId: dropTarget.afterId ?? null,
          optimistic: false,
          snapshot: snapshot ?? null,
        });
      }

      setActiveId(null);
      setDropTarget(null);
      setCollapsedSnapshot(null);
      dragStartPointerRef.current = null;
      window.setTimeout(() => {
        didDragRef.current = false;
      }, 0);
    },
    [collapsedSnapshot, dropTarget, moveNote, moveNodeWithSnapshot, nodes, toggleExpanded],
  );

  const handleDragCancel = React.useCallback(() => {
    if (collapsedSnapshot?.wasExpanded) {
      toggleExpanded(collapsedSnapshot.id, true);
    }
    setActiveId(null);
    setDropTarget(null);
    setCollapsedSnapshot(null);
    dragStartPointerRef.current = null;
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  }, [collapsedSnapshot, toggleExpanded]);

  const handleRowClickCapture = React.useCallback((event: React.MouseEvent) => {
    if (!didDragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    didDragRef.current = false;
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragMove={updateDropTarget}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      autoScroll={{ threshold: { y: 0.2, x: 0.1 }, acceleration: 1.2 }}
    >
      <div
        ref={setRootDropRef}
        className={`transition-[opacity,translate,scale] duration-300 ${rows.length > 0 ? "opacity-100" : "-translate-x-2 scale-95 opacity-0"}`}
      >
        {rows.map((row) => {
          const key = row.kind === "node" ? row.id : `${row.parentId ?? "root"}-more`;

          return (
            <TreeRow
              key={key}
              row={row}
              activeId={activeId}
              dropTarget={dropTarget}
              parentHighlightId={parentHighlightId}
              onRowClickCapture={handleRowClickCapture}
              isAnyDragging={Boolean(activeId)}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeId && nodes[activeId] ? (
          <TreeDragOverlayRow node={nodes[activeId]} meta={meta[activeId]} depth={activeRowDepth} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
