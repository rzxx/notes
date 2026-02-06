import { Errors } from "@/lib/errors";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const MIN_SENTINEL = -1;
const MAX_SENTINEL = ALPHABET.length;

const indexOfChar = (char: string) => {
  const index = ALPHABET.indexOf(char);
  if (index === -1) throw new Error(`Invalid LexoRank character: ${char}`);
  return index;
};

const pickBetween = (prev: string | null, next: string | null) => {
  const low = prev ?? "";
  const high = next ?? "";

  let i = 0;
  let result = "";

  // Algorithm adapted from fractional indexing: find a char strictly between
  // low and high at each position, extending if needed.
  for (;;) {
    const prevCode = i < low.length ? indexOfChar(low[i]!) : MIN_SENTINEL;
    const nextCode =
      next === null ? MAX_SENTINEL : i < high.length ? indexOfChar(high[i]!) : MIN_SENTINEL;

    const start = prevCode + 1;
    const end = nextCode === MIN_SENTINEL ? ALPHABET.length - 1 : nextCode - 1;

    if (start <= end) {
      const mid = Math.floor((start + end) / 2);
      result += ALPHABET[mid];
      return result;
    }

    // No space at this position; carry forward the limiting char and continue.
    result += i < low.length ? low[i] : ALPHABET[0];
    i += 1;
  }
};

export const rankBetween = (prev: string | null, next: string | null) => {
  if (prev !== null && next !== null && !(prev < next)) {
    throw Errors.RANK_EXHAUSTED(prev, next);
  }

  const candidate = pickBetween(prev, next);
  if (prev !== null && !(prev < candidate)) {
    throw Errors.RANK_EXHAUSTED(prev, next);
  }
  if (next !== null && !(candidate < next)) {
    throw Errors.RANK_EXHAUSTED(prev, next);
  }

  return candidate;
};

export const rankAfter = (prev: string | null) => rankBetween(prev, null);
export const rankBefore = (next: string | null) => rankBetween(null, next);
export const rankInitial = () => rankBetween(null, null);

export const compareRanks = (a: string, b: string) => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};
