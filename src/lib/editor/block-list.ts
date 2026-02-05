export type BlockLike = {
  id: string;
  position: number;
};

export const sortBlocks = <T extends BlockLike>(blocks: T[]): T[] =>
  [...blocks].sort((a, b) =>
    a.position !== b.position ? a.position - b.position : a.id.localeCompare(b.id),
  );

export const normalizeBlockPositions = <T extends BlockLike>(blocks: T[]): T[] =>
  sortBlocks(blocks).map((block, index) => ({ ...block, position: index }));

export const insertBlockAt = <T extends BlockLike>(
  blocks: T[],
  newBlock: T,
  position: number,
): T[] => {
  const ordered = sortBlocks(blocks);
  const clamped = Math.max(0, Math.min(position, ordered.length));
  const next = [...ordered];
  next.splice(clamped, 0, { ...newBlock, position: clamped });
  return next.map((block, index) => ({ ...block, position: index }));
};

export const replaceBlockById = <T extends BlockLike>(
  blocks: T[],
  id: string,
  replacement: T,
): T[] => blocks.map((block) => (block.id === id ? replacement : block));

export const removeBlockById = <T extends BlockLike>(blocks: T[], id: string): T[] =>
  blocks.filter((block) => block.id !== id);

export const reorderBlocksByIds = <T extends BlockLike>(
  blocks: T[],
  orderedIds: string[],
): T[] | null => {
  const blockMap = new Map(blocks.map((block) => [block.id, block] as const));
  if (blockMap.size !== orderedIds.length) return null;

  const reordered: T[] = [];
  for (const [index, id] of orderedIds.entries()) {
    const block = blockMap.get(id);
    if (!block) return null;
    reordered.push({ ...block, position: index });
  }

  if (reordered.length !== blocks.length) return null;
  return reordered;
};
