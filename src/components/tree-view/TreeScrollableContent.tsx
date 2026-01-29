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
  activeRect: { top: number; height: number } | null,
  overRect: { top: number; height: number } | null,
): DropPosition => {
  if (!activeRect || !overRect) return "inside";
  const centerY = activeRect.top + activeRect.height / 2;
  const topEdge = overRect.top + overRect.height * 0.3;
  const bottomEdge = overRect.top + overRect.height * 0.7;
  if (centerY < topEdge) return "before";
  if (centerY > bottomEdge) return "after";
  return "inside";
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
  const moveNode = useTreeStore((state) => state.moveNode);

  useSyncRouteSelection();

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null);
  const [collapsedSnapshot, setCollapsedSnapshot] = React.useState<{
    id: string;
    wasExpanded: boolean;
  } | null>(null);

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

  const updateDropTarget = React.useCallback(
    (event: DragMoveEvent | DragOverEvent) => {
      if (!activeId || !event.over) {
        setDropTarget(null);
        return;
      }

      const overId = String(event.over.id);
      if (overId === ROOT_DROP_ID) {
        setDropTarget({
          overId,
          position: "after",
          newParentId: null,
          beforeId: null,
          afterId: null,
        });
        return;
      }

      if (!nodes[overId]) {
        setDropTarget(null);
        return;
      }

      const activeRect =
        event.active.rect.current.translated ?? event.active.rect.current.initial ?? null;
      const overRect = event.over.rect ?? null;
      const position = getDropPosition(activeRect, overRect);

      if (overId === activeId) {
        setDropTarget(null);
        return;
      }

      const overNode = nodes[overId];
      const newParentId = position === "inside" ? overId : (overNode.parentId ?? null);
      const beforeId = position === "before" ? overId : null;
      const afterId = position === "after" ? overId : null;

      if (newParentId === activeId) {
        setDropTarget(null);
        return;
      }

      if (isDescendant(activeId, newParentId, meta)) {
        setDropTarget(null);
        return;
      }

      setDropTarget({ overId, position, newParentId, beforeId, afterId });
    },
    [activeId, meta, nodes],
  );

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const nextId = String(event.active.id);
      setActiveId(nextId);
      setDropTarget(null);

      const wasExpanded = meta[nextId]?.isExpanded ?? false;
      if (wasExpanded) {
        toggleExpanded(nextId, false);
        setCollapsedSnapshot({ id: nextId, wasExpanded });
      } else {
        setCollapsedSnapshot({ id: nextId, wasExpanded: false });
      }
    },
    [meta, toggleExpanded],
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
  }, [collapsedSnapshot, toggleExpanded]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragMove={updateDropTarget}
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
        {rows.map((row) => (
          <TreeRow
            key={row.kind === "node" ? row.id : `${row.parentId ?? "root"}-more`}
            row={row}
            activeId={activeId}
            dropTarget={dropTarget}
          />
        ))}
      </div>

      <DragOverlay>
        {activeId && nodes[activeId] ? (
          <TreeDragOverlayRow node={nodes[activeId]} meta={meta[activeId]} depth={activeRowDepth} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
