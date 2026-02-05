# Editor Update Plan

This plan covers: refactor ideas, bug fixes, lexorank adoption for block ordering, and UX/behavior improvements. Order reflects dependency and risk reduction.

## Phase 1: Refactor + Bug Fixes

### A) Centralize block-list transforms

- Create a shared helper to manage block list operations used by optimistic updates.
- Target operations: sort, insert at position, normalize positions, replace by id, remove by id.
- Use the helper in:
  - `src/lib/hooks/editor/useCreateBlock.ts`
  - `src/lib/hooks/editor/useSplitBlock.ts`
  - `src/lib/hooks/editor/useMergeBlocks.ts`
  - `src/lib/hooks/editor/useDeleteBlock.ts`
  - `src/lib/hooks/editor/useReorderBlocks.ts`
  - `src/components/editor/NoteEditor.tsx` (sorting, display order)

### B) Add BlockContent schema

- Define a `BlockContent` schema per block type (Zod) and a shared TypeScript type.
- Use schema validation in:
  - `src/lib/db/validators.ts`
  - block API routes (create/update/split/merge)
  - editor rendering helpers (`getBlockText` and per-type renderers)

### C) Introduce editor session layer

- Create a dedicated hook or module that owns:
  - active block state
  - draft text lifecycle
  - flush/cancel semantics for debounced updates
  - focus transitions on split/merge/delete
- Keep `NoteEditor` as a thin view layer consuming this session API.

### D) Fix data-loss on unmount

- Ensure pending debounced edits are flushed on unmount and/or before editor state is cleared.
- Change behavior in `src/lib/hooks/editor/useUpdateBlock.ts` cleanup to flush instead of cancel.
- In `src/components/editor/NoteEditor.tsx`, flush pending updates before `clearNote`.

### E) Fix active block stale state on delete

- On successful delete of the active block, clear active state or move focus to nearest block.
- Add post-delete focus logic in `NoteEditor` (preferred) or in the delete hook onSuccess.

### F) Auto-insert retry for empty note

- If initial block auto-insert fails, allow retry instead of locking out for session.
- Reset `autoInsertedRef` on error or gate it by successful create only.

## Phase 2: Lexorank for Block Ordering

### A) Schema and model changes

- Add a `rank` column to blocks and index it per note.
- Keep `position` temporarily or migrate fully to rank.

### B) Server ordering updates

- Replace integer position shifting with rank calculations in:
  - `createBlock`
  - `splitBlock`
  - `mergeBlocks`
  - `deleteBlock`
  - `reorderBlocks`
- Provide a `rebuildBlockRanks` utility to repair rank gaps.

### C) Client ordering updates

- Update sorting to use rank (fallback to id for stability).
- Reorder mutation should send ids plus optional anchors (before/after) or complete ordered ids.

## Phase 3: UX / Behavior Gaps

### A) Navigation and focus

- Keyboard navigation between blocks (ArrowUp/ArrowDown at boundaries).
- Consistent focus transfer on create/split/merge/delete.

### B) Status and feedback

- Show subtle “saving…” or “synced” indicator for drafts.
- Allow per-block busy states instead of global disable.

### C) Editor affordances

- Add slash command stub for block type changes.
- Add basic list support for bullet/numbered/todo (even if render-only first).

## Notes

- Prioritize Phase 1 before adding new features to avoid compounding tech debt.
- Lexorank can be built on top of the new shared block-list helper to reduce churn.
