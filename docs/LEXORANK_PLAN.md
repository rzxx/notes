LexoRank rollout plan

Goals

- Add sibling-level ordering using LexoRank strings per parent.
- Keep API and client tree lists ordered by rank, not createdAt.
- Extend move operation to handle reparent + reordering (before/after anchors) safely.

Schema + migration

- Add `rank text not null` to `notes`; unique per `(user_id, parent_id, rank)`; index by `(user_id, parent_id, rank, id)` for ordered lookups.
- Migration seeds ranks from current ordering (created_at desc, id desc → assign descending ranks like `hzz...`).
- Store a small helper for initial rank constants if needed (could live in db util later).

Create note behavior

- On insert, assign rank as the end of sibling list (e.g., after max rank; if none, use mid-base like `hzz...`).
- Return rank as part of note payloads if needed by clients.

Move behavior

- Signature: `{ userId, noteId, newParentId, beforeId?, afterId? }`; only one of before/after allowed; siblings must share parent after move.
- Validate existence, same user, cycle prevention when reparenting; ensure anchors belong to target parent.
- Compute target rank using surrounding ranks: between(prevRank, nextRank); handle edge cases (only before → use before’s prev; only after → use after’s next; neither → append to end).
- Update `notes.parent_id` and `notes.rank`, then rebuild closure rows for the moved subtree as today.
- No-op if parent+rank unchanged.

Listing/order

- `getNotesList` should order by `rank asc, id asc` (or consistent tiebreak) and expose `rank` to clients.
- Cursoring should use rank+id instead of createdAt.

API + validators

- Extend `moveNoteSchema` to accept `beforeId`/`afterId` (nullable uuid) and require one when reordering.
- Update `/api/notes/move` handler to pass new args and return updated info as needed.

Client updates

- `useMoveNote` mutation signature to include anchors and target parent; wire to tree store update that respects server order (stop relying on createdAt).
- Tree store sorting should use `rank` values from server; preserve order as provided rather than re-sorting by createdAt.
- `useNotesChildren`/pager should carry rank through queries so components render in ranked order.

Cleanup

- Remove the demo “Move note” section from `src/app/(main)/page.tsx` until drag-and-drop UI is built.

Follow-ups/tests

- Run typecheck and quick API sanity (e.g., move scenarios) after implementation.
