Plan: Grainy Notes Next.js Rewrite

Context

- Decisions: PostgreSQL + Drizzle, betterauth, TanStack Query + Zustand, custom component library, lightweight custom editor that is swappable, deploy on Vercel.

Phase 1: Foundations & Spine

- Next.js App Router with TypeScript strict, ESLint/Prettier, CI (lint/type/test), Vercel env scaffolding.
- Drizzle schema: users, notes, blocks with UNIQUE (user_id, path); block position integer; FTS index on blocks.content; seed script.
- Auth: betterauth; middleware for protected routes; public vs protected boundary.
- API: app/api/notes (paginated list), app/api/notes/[...path] (get/update/delete), app/api/notes/create (unique naming), app/api/notes/search (FTS); standardized error shape.
- State: TanStack Query provider and base hooks; Zustand for local UI state (drawers/menus).
- UI shell: responsive three-column scaffold with noise/gradient tokens; placeholder editor and navigation list.
- Acceptance: local run + CI green; can create/read stub note via API; auth session works; preview deploy on Vercel with validated envs.

Phase 2: Core Feature Parity

- Navigation: hierarchical path browsing from server data; create/move/delete with validation and unique naming; pagination/infinite scroll for lists.
- Notes: lightweight custom block editor (paragraph, heading, divider) with optimistic mutations; reorder via position; autosave/blur save.
- Search: PostgreSQL FTS, debounced client; metadata-only results, scoped per user.
- Error handling: normalized API errors; client toasts/fallbacks; auth guard middleware redirects.
- Tests: unit (path parse/naming), integration (auth, notes CRUD, search).
- Acceptance: register/login, browse hierarchy, create/edit/delete/reorder blocks, search returns expected notes; tests passing.

Phase 3: Quality & Polish

- UI fidelity: custom noise/shadows/gradients; responsive polish; Suspense-based loading and error boundaries around editor/shell.
- Validation: Zod for inputs/responses/env; shared inferred types across API and client.
- Observability: structured logging server-side, basic error tracking (e.g., Sentry), slow-query logging; 404/500 pages.
- DX: stricter lint rules, seeds/fixtures, component demos, performance budgets.
- Acceptance: visual parity with legacy aesthetic; clear validation errors; logs/error tracking in place; component demos load.

Phase 4: Upgrades & New Capabilities

- Auth: refresh rotation, password reset, optional OAuth providers; middleware session checks; auth event audit log.
- Sharing groundwork: schema extensions for view/edit sharing and invite links (feature-flagged).
- UX upgrades: keyboard shortcuts, command palette, drag-and-drop for blocks/paths, mobile nav polish/PWA.
- Data/features: export (Markdown/HTML), version history via block snapshots, API rate limiting, background revalidation + cache headers.
- Acceptance: OAuth works, sharing flaggable, shortcuts/palette/dnd functional, exports/history verified in tests, rate limits enforced.

Editor Swap Strategy

- Keep block schema minimal (type/content/properties, position) with no library-specific fields.
- Expose editor operations via adapter (insert/delete/move/update) so a richer library (Tiptap/Slate) can be slotted later.
