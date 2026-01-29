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
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { selectFlatRows, useTreeStore } from "@/lib/stores/tree";
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getApproxTitleWidth = (title: string) => {
  const averageCharWidth = 7.5;
  const textWidth = title.length * averageCharWidth;
  return clamp(textWidth, 80, 240) + 24;
};

export function TreeScrollableContent() {
  const rows = useTreeStore(selectFlatRows);
  const nodes = useTreeStore((state) => state.nodes);
  const meta = useTreeStore((state) => state.meta);
  const toggleExpanded = useTreeStore((state) => state.toggleExpanded);
  const moveNode = useTreeStore((state) => state.moveNode);

  useSyncRouteSelection();

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null);
  const [collapsedSnapshot, setCollapsedSnapshot] = React.useState<{
    id: string;
    wasExpanded: boolean;
  } | null>(null);
  const dragStartPointerRef = React.useRef<{ x: number; y: number } | null>(null);

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

  const rowDepthById = React.useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row) => {
      if (row.kind === "node") map.set(row.id, row.depth);
    });
    return map;
  }, [rows]);

  const isSameDropTarget = React.useCallback((a: DropTarget | null, b: DropTarget | null) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return (
      a.overId === b.overId &&
      a.position === b.position &&
      a.newParentId === b.newParentId &&
      a.beforeId === b.beforeId &&
      a.afterId === b.afterId
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
    (event: DragOverEvent) => {
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

      if (!nodes[overId]) {
        setDropTarget((prev) => (prev ? null : prev));
        return;
      }

      const overRect = event.over.rect ?? null;
      const overDepth = rowDepthById.get(overId) ?? 0;
      const startPointer = dragStartPointerRef.current;
      const pointer = startPointer
        ? { x: startPointer.x + event.delta.x, y: startPointer.y + event.delta.y }
        : null;
      const titleWidth = getApproxTitleWidth(nodes[overId]?.title ?? "");
      const position = getDropPosition(pointer, overRect, overDepth, titleWidth);

      if (overId === activeId) {
        setDropTarget((prev) => (prev ? null : prev));
        return;
      }

      const overNode = nodes[overId];
      const newParentId = position === "inside" ? overId : (overNode.parentId ?? null);
      const beforeId = position === "before" ? overId : null;
      const afterId = position === "after" ? overId : null;

      if (newParentId === activeId) {
        setDropTarget((prev) => (prev ? null : prev));
        return;
      }

      if (isDescendant(activeId, newParentId, meta)) {
        setDropTarget((prev) => (prev ? null : prev));
        return;
      }

      const nextTarget = { overId, position, newParentId, beforeId, afterId };
      setDropTarget((prev) => (isSameDropTarget(prev, nextTarget) ? prev : nextTarget));
    },
    [activeId, isSameDropTarget, meta, nodes, rowDepthById],
  );

  const parentHighlightId =
    dropTarget && dropTarget.position !== "inside" ? dropTarget.newParentId : null;

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const nextId = String(event.active.id);
      setActiveId(nextId);
      setDropTarget(null);
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
        moveNode(nextActiveId, dropTarget.newParentId, {
          beforeId: dropTarget.beforeId ?? undefined,
          afterId: dropTarget.afterId ?? undefined,
        });
      }

      setActiveId(null);
      setDropTarget(null);
      setCollapsedSnapshot(null);
      dragStartPointerRef.current = null;
    },
    [collapsedSnapshot, dropTarget, moveNode, toggleExpanded],
  );

  const handleDragCancel = React.useCallback(() => {
    if (collapsedSnapshot?.wasExpanded) {
      toggleExpanded(collapsedSnapshot.id, true);
    }
    setActiveId(null);
    setDropTarget(null);
    setCollapsedSnapshot(null);
    dragStartPointerRef.current = null;
  }, [collapsedSnapshot, toggleExpanded]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={updateDropTarget}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      autoScroll={{ threshold: { y: 0.2, x: 0.1 }, acceleration: 1.2 }}
    >
      <div
        ref={setRootDropRef}
        className={`space-y-1 transition-[opacity,translate,scale] duration-300 ${rows.length > 0 ? "opacity-100" : "-translate-x-2 scale-95 opacity-0"}`}
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
