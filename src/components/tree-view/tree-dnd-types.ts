export type DropPosition = "before" | "after" | "inside";

export type DropTarget = {
  overId: string;
  position: DropPosition;
  newParentId: string | null;
  beforeId?: string | null;
  afterId?: string | null;
};
