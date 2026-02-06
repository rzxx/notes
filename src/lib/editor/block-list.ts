import { compareRanks, rankAfter, rankBetween, rankInitial } from "@/lib/lexorank";
import { isAppError } from "@/lib/errors";

export type BlockLike = {
  id: string;
  rank: string;
};

export const sortBlocks = <T extends BlockLike>(blocks: T[]): T[] =>
  [...blocks].sort((a, b) => {
    const rankComparison = compareRanks(a.rank, b.rank);
    return rankComparison !== 0 ? rankComparison : a.id.localeCompare(b.id);
  });

export const rebuildBlockRanks = <T extends BlockLike>(blocks: T[]): T[] => {
  const ordered = sortBlocks(blocks);
  return rebuildBlockRanksInOrder(ordered);
};

const rebuildBlockRanksInOrder = <T extends BlockLike>(blocks: T[]): T[] => {
  let prev: string | null = null;

  return blocks.map((block) => {
    const rank = prev ? rankAfter(prev) : rankInitial();
    prev = rank;
    return { ...block, rank };
  });
};

export const insertBlockAt = <T extends BlockLike>(
  blocks: T[],
  newBlock: T,
  position: number,
): T[] => {
  let ordered = sortBlocks(blocks);
  const clamped = Math.max(0, Math.min(position, ordered.length));

  const computeRank = (source: T[]) => {
    const lowerRank = clamped > 0 ? (source[clamped - 1]?.rank ?? null) : null;
    const upperRank = clamped < source.length ? (source[clamped]?.rank ?? null) : null;
    return rankBetween(lowerRank, upperRank);
  };

  let rank: string;
  try {
    rank = computeRank(ordered);
  } catch (error) {
    if (!isAppError(error) || error.code !== "RANK_EXHAUSTED") throw error;
    ordered = rebuildBlockRanks(ordered);
    rank = computeRank(ordered);
  }

  const next = [...ordered];
  next.splice(clamped, 0, { ...newBlock, rank });
  return next;
};

export const replaceBlockById = <T extends BlockLike>(
  blocks: T[],
  id: string,
  replacement: T,
): T[] => blocks.map((block) => (block.id === id ? replacement : block));

export const removeBlockById = <T extends BlockLike>(blocks: T[], id: string): T[] =>
  blocks.filter((block) => block.id !== id);

export const reorderBlockWithAnchors = <T extends BlockLike>(
  blocks: T[],
  input: {
    blockId: string;
    beforeId?: string | null;
    afterId?: string | null;
  },
): T[] | null => {
  const { blockId, beforeId = null, afterId = null } = input;
  if (!beforeId && !afterId) return null;

  const ordered = sortBlocks(blocks);
  const moving = ordered.find((block) => block.id === blockId);
  if (!moving) return null;

  let withoutMoving = ordered.filter((block) => block.id !== blockId);
  const beforeIndex = beforeId ? withoutMoving.findIndex((block) => block.id === beforeId) : -1;
  const afterIndex = afterId ? withoutMoving.findIndex((block) => block.id === afterId) : -1;

  if (beforeId && beforeIndex < 0) return null;
  if (afterId && afterIndex < 0) return null;
  if (beforeId && afterId && afterIndex >= beforeIndex) return null;

  const insertionIndex = beforeId ? beforeIndex : afterIndex + 1;
  withoutMoving.splice(insertionIndex, 0, moving);

  const computeRank = (source: T[]) => {
    const movedIndex = source.findIndex((block) => block.id === blockId);
    const lowerRank = movedIndex > 0 ? (source[movedIndex - 1]?.rank ?? null) : null;
    const upperRank =
      movedIndex < source.length - 1 ? (source[movedIndex + 1]?.rank ?? null) : null;
    return rankBetween(lowerRank, upperRank);
  };

  let nextRank: string;
  try {
    nextRank = computeRank(withoutMoving);
  } catch (error) {
    if (!isAppError(error) || error.code !== "RANK_EXHAUSTED") throw error;
    withoutMoving = rebuildBlockRanksInOrder(withoutMoving);
    nextRank = computeRank(withoutMoving);
  }

  return withoutMoving.map((block) =>
    block.id === blockId ? { ...block, rank: nextRank } : block,
  );
};
