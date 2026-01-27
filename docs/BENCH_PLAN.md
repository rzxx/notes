# TreeView Bench Plan

Goals: measure flatten/buildFlat cost, depth cache impact, and eviction (collapse-to-evict) impact across small to stress-test trees using bun bench, no new dependencies.

Scenarios (fixed set of fixtures)

- Level 1: ~10 nodes (sanity check, ensures harness overhead is low).
- Level 2: ~1k nodes (light real-world-ish).
- Level 3: ~10–20k nodes (medium realistic load).
- Level 4: ~50–80k nodes mixed wide/deep (primary decision dataset).
- Level 5: ≥250k nodes stress; scale down only if it blows up, and note the cap in output. If feasible, try higher to find limits.

Variants (hardcoded)

- Baseline: walk-based depth computation; memoized selector only.
- Depth cache: maintain depth map on upsert/move/remove; buildFlat reads cached depths.
- Eviction: simulate collapse-to-evict (skip children of collapsed branches during flatten to mimic memory relief).
- Depth cache + eviction: combined behavior to see interaction.

Bench flow (per level, per variant)

1. Cold flatten timing from fresh store built from fixture (measures pure buildFlat).
2. Mutation script (fixed sequence, e.g., ~2k ops scaled by level: moves/inserts/deletes) applied to a cloned store; time mutation batch.
3. Post-mutation flatten timing (hot path after changes).
4. Repeat small iteration count (e.g., 5) to derive mean + p95; gather memory via `process.memoryUsage()` snapshots if bun inspector is too heavy.

Implementation steps (no external libs; place code under `src/bench/depthcacheeviction/`)

- Step 1: Fixture generator
  - Seeded RNG; produce multiple tree shapes (wide, balanced, deep) and merge into mixed fixtures per level.
  - Deterministic ordering (`createdAt`, id tiebreak) and expansion map baked into fixture.
  - Hard point: keep generation O(n); avoid recursion depth limits on deep chains.

- Step 2: Store/variant adapters
  - Minimal store implementation mirroring TreeView store shape; toggles for depth cache and eviction.
  - Hard point: ensure depth cache updates on upsert/move/remove; eviction honors expansion map and skips children for collapsed nodes without mutating fixture data.

- Step 3: Mutation script
  - Fixed operation list reused across variants (derived from fixture ids) so results are comparable.
  - Hard point: keep operations valid (avoid deleting already-deleted ids); precompute targets.

- Step 4: Bench runner
  - Use bun’s bench utilities; run all levels × variants; clone fixtures cheaply (structural sharing if possible).
  - Hard point: ensure timers exclude setup where intended; isolate GC noise as best as practical.

- Step 5: Reporting
  - Print table/log per level with cold flatten, mutation, post-mutation times, plus p95 if easy; note if Level 5 was capped.
  - Hard point: keep output small and readable; fail gracefully if stress level exhausts memory.

Notes

- No CLI flags; everything is baked in the bench runner.
- If Level 5 or combined variant cannot allocate, detect and record the limit instead of crashing the run.
- Progress: fixture generator (Levels 1–5, seeded mixed shapes), store variant scaffolding (baseline, depth cache, eviction, combined), mutation script generator/applier (`mutations.ts` with seeded deterministic move/insert/remove mix), and bench runner (`bench.ts`) are in `src/bench/depthcacheeviction/`.
- Bench runner: executes all levels × variants, captures cold flatten, mutation batch, post-flatten mean/p95, row counts, and peak RSS; caps iterations for stress level (3 instead of 5). Run with `bun run src/bench/depthcacheeviction/bench.ts`.
- Adjust progress: flatten parity is implemented (load-more gated on expansion, children before sentinel, root-level load-more via rootPagination), and fixtures now include rootPagination for root sentinel emission. **Updated:** fixtures now default to collapsed nodes with only some roots expanded (with a fallback so at least one root is open) to match app mounting behavior. **New:** bench store handles dangling children (parks inserts/moves whose parent is missing and reattaches when the parent arrives). **Updated:** move/remove now mirror app semantics: remove deletes only the target node/meta and prunes references (no subtree wipe), move detaches/attaches with deduped sorted merge and auto-expands the new parent while preserving dangling parking and depth-cache updates. **Updated:** ordering now mirrors the app: fixtures and mutation inserts use ISO `createdAt` strings, merges keep children/root ids sorted via createdAt-desc with id tiebreak (no resort-at-end), and store comparisons parse timestamps. Pending: realistic baseline variant.

Status and alignment check (2026-01-27)

- Implemented: seeded fixtures Levels 1–5 with mixed shapes, root pagination, default-collapsed nodes with some roots expanded; flatten parity with app (children-first, load-more only when expanded, root sentinel); dangling handling for missing parents; depth-cache toggle; eviction toggle modeled as non-destructive (skip collapsed subtrees, no child wipes); bench loop collects mean/p95 per stage plus peak RSS.
- Updated for parity: store insert/move/remove now use app-like `mergeSortedIds` ordering and sweep reference pruning; mutation generator deletes single nodes (no subtree wipes) to mirror app semantics.
- Divergences that remain: eviction is still modeled logically (no runtime drop/restore tied to collapse events); runner uses manual `performance.now()` loops instead of `bun bench` helpers (acceptable for now).
- Latest run: lint is clean; `bun run src/bench/depthcacheeviction/bench.ts` completes through L1–L4 on Windows/Bun 1.3.6; L5 likely needs a longer timeout on this machine.

Next adjustments (optional)

- Eviction behavior: if we want to study collapse-to-evict, add a simulated expand/collapse cycle in the bench that drops/reattaches children under eviction mode instead of keeping them in memory.

- Interaction churn: add a small expand/collapse and load-more exercise so flatten/eviction paths see real UI-like toggling and pagination updates instead of a static fully-loaded tree.

ADJUST TASKS (align bench with app behavior)

- Flatten parity
  - Issue: bench buildFlat emits load-more rows even when collapsed and before children; app only appends them after children for expanded nodes and also adds a root-level load-more based on rootPagination.
  - Adjust: match sentinel ordering (children first, then load-more), gate load-more on isExpanded, and include rootPagination.hasMore to emit the root load-more row.

- Expansion defaults
  - Issue: fixtures mark most nodes expanded; app mounts collapsed and expands per user/fetch state.
  - Adjust: generate fixtures with collapsed nodes by default (roots optionally expanded), and ensure flatten short-circuits on collapsed nodes to reflect UI.

- Root pagination and dangling
  - Issue: bench store omits rootPagination and danglingByParent; inserts/moves to missing parents are dropped.
  - Adjust: add rootPagination state and load-more handling; add dangling buckets so moves/inserts to unloaded parents park and later attach when parent arrives. Include this path in variants so depth cache/eviction are measured with dangling reconciliation.

- Move/remove semantics
  - Issue: bench remove deletes whole subtree; app removes a single node and prunes references, leaving potential orphans. Bench move neither forces expansion nor dedupes merge like mergeSorted.
  - Adjust: make remove mirror app (delete node/meta, prune references only); make move detach/attach with mergeSorted-like dedupe/sort and set new parent expanded=true. Preserve dangling parking when target parent missing.

- Ordering and fields
  - Issue: bench sorts via numeric createdAt and resort-per-insert; app sorts by parsed createdAt string with id tiebreak using mergeSorted stable merges.
  - Adjust: mirror app ordering (createdAt desc, id tiebreak) and merge strategy instead of full re-sort on every insert.

- Variant coverage
  - Issue: baseline variant is already divergent; comparisons may conflate behavioral gaps with depth-cache/eviction effects.
  - Adjust: add a “realistic” baseline that mirrors app semantics (flatten, pagination, dangling, move/remove, ordering) before layering depth cache/eviction variants, so perf deltas isolate the intended knobs.

- Eviction realism and interaction workload
  - Issue: eviction variant keeps children parked but never drops/restores on collapse/expand, and workload never triggers expansion/pagination churn, so eviction results are not decision-grade.
  - Adjust: add explicit collapse/expand operations to the mutation script; in eviction mode, collapse should evict children (retain ids in an evicted bucket) and expand should restore them and refresh depths. Integrate a per-level interaction phase that toggles expansion on nodes with children (plus root/child load-more sentinel emission) so flatten and eviction paths see realistic churn. Keep operations deterministic off existing seeds.
