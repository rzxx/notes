# Grainy Notes - Legacy Documentation (v1.0)

**Purpose:** Complete documentation of the original implementation to guide the Next.js/TypeScript rewrite without looking at old code.

---

## 1. Project Overview

**Grainy Notes** is a hierarchical note-taking application with a custom block-based editor and file-like path organization.

**Core Value Proposition:** Users expect familiar folder/file navigation in note apps (like Notion's workspace structure), not a flat list or tag-based system. The app delivers this with visual flair through noise textures and custom design language.

**Target Users:** Individuals who want to organize thoughts in nested structures (projects → sub-projects → notes) while maintaining a clean, distraction-free writing experience.

**Current Limitations:**

- No real-time collaboration
- No rich text formatting (only plain text)
- Limited to single-user accounts
- No sharing capabilities
- No version history or undo/redo

**Key Features (to preserve in v2):**

1. Hierarchical path-based navigation (`/work/project/notes`)
2. Block-based content editing (paragraphs, headings, dividers)
3. Full-text search across all notes
4. Mobile-responsive design
5. Clean, modern UI with noise texture aesthetic

---

## 2. System Architecture

### Tech Stack (Legacy)

**Frontend:**

- React 19 (no framework, custom routing)
- Vite (dev server, bundler)
- React Router 7 (client-side routing)
- Tailwind CSS 4 (styling)
- Custom SVG noise filters

**Backend:**

- Fastify (Node.js web framework)
- Mongoose (MongoDB ODM)
- JWT (custom authentication)
- bcrypt (password hashing)
- Netlify Functions (serverless deployment)

**Database:**

- MongoDB (document store)
- Self-hosted or Atlas

**Deployment:**

- Netlify (SPA + serverless functions)
- Vite build to `dist/`
- Backend functions in `backend/` directory
- Proxy configuration for dev server

### High-Level Architecture

The app follows a classic SPA pattern:

1. Client loads React app on initial request
2. Authentication stored in localStorage (JWT token)
3. All API requests go through `/api/*` endpoints
4. Backend uses Netlify Functions to handle requests
5. Database queries via Mongoose models

### Request Flow

1. User interacts with UI component
2. Component triggers API call (fetch)
3. Request goes to backend (via proxy in dev, netlify in prod)
4. Middleware validates JWT token
5. Route handler queries MongoDB
6. Response returned to frontend
7. State updated and UI re-renders

### Deployment Architecture

**Netlify Setup:**

- Frontend: Build to `dist/`, served as static files
- Backend: Netlify Functions in `backend/` directory
- Proxy rules: `/api/*` redirects to `/.netlify/functions/server/:splat`
- Catch-all redirect: `/*` → `/index.html` for SPA routing
- Auto-installs function dependencies on deploy

---

## 3. Data Structures & Schema

### MongoDB Schemas

**User Schema:**

```javascript
{
  _id: ObjectId,
  username: String (unique, required, max 50 chars),
  password_hash: String (required, bcrypt hash)
}
```

**Note Schema:**

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, required, indexed),
  title: String (required, trim, max 255 chars),
  path: String (required, trim, starts with '/'),
  blocks: [
    {
      type: String ('paragraph' | 'heading_one' | 'divider'),
      content: String (default ''),
      properties: Object (mixed, default {}),
      children: Array (mixed, default [])
    }
  ],
  createdAt: Date (default: now),
  updatedAt: Date (default: now, auto-update on save)
}

Indexes: { userId: 1, path: 1 } (unique)
```

### Path System Design

**Concept:** Notes are organized hierarchically using file-like paths:

- Root: `/`
- Level 1: `/work`, `/personal`, `/ideas`
- Level 2: `/work/project-1`, `/work/project-2`
- Level 3: `/work/project-1/meeting-notes`

**Path Validation:**

- Must start with `/`
- No trailing slashes allowed (except root `/`)
- Case-sensitive
- No empty segments (`/work//notes` is invalid)

**Path-Based Queries:**

- **Current directory notes:** Filter notes whose path depth = current depth + 1 AND path starts with current path + `/`
- **Parent directory:** If current depth > 0, navigate up one segment level
- **Root navigation:** Show all depth 1 notes when path is `/`

**Relationships:**

- Paths are logical, not physical (no parent IDs in schema)
- Relationships determined by path string manipulation
- Deleting a note doesn't delete children (they become orphans at that path)

---

## 4. API Endpoints

### Authentication

**POST /api/register**

- Request: `{ username, password }`
- Validation: username required, password min 6 chars
- Success: 201 Created
- Errors: 409 Conflict (username exists), 400 Bad Request

**POST /api/login**

- Request: `{ username, password }`
- Success: Returns `{ token, username, userId }`
- Errors: 401 Unauthorized (invalid credentials), 400 Bad Request

**Auth Middleware:**

- Validates JWT from `Authorization: Bearer <token>` header
- Decodes token, fetches user from DB
- Attaches user object to request
- Returns 401 if token invalid or user not found

### Notes CRUD

**GET /api/notes**

- Protected route
- Returns all user's notes (title, path only, no blocks)
- Sorted by `updatedAt` descending
- Used for navigation lists

**GET /api/notes/\* (path)**

- Protected route
- Returns full note (title, path, blocks, timestamps)
- Path extracted from wildcard parameter
- Returns 404 if note not found or user doesn't own it

**POST /api/notes**

- Protected route
- Request: `{ title, path, blocks }`
- Creates new note with userId from auth
- Returns created note
- Errors: 409 Conflict (path already exists), 400 Bad Request (validation)

**PUT /api/notes/\* (path)**

- Protected route
- Request: `{ title?, path?, blocks? }` (partial update)
- Updates note at specified path
- Can rename path (triggers redirect on frontend)
- Returns updated note
- Errors: 404 Not Found, 409 Conflict (new path exists)

**DELETE /api/notes/\* (path)**

- Protected route
- Deletes note at specified path
- Returns success message
- Errors: 404 Not Found

### Search

**GET /api/notes/search?q=<query>**

- Protected route
- Search parameter required, non-empty
- Searches `blocks` array for matching content
- Searches in `paragraph` and `heading_one` block types
- Case-insensitive regex search
- Returns top 5 results sorted by `updatedAt`
- Each result: `{ _id, title, path, createdAt, updatedAt }` (no blocks)
- Errors: 400 Bad Request (missing query)

**Search Implementation Note:**

- Uses `$elemMatch` to search within nested blocks array
- Regex-escaped query to prevent injection
- Limited to 5 results for performance
- Searches content field only, not titles or paths

---

## 5. Frontend Architecture

### Component Hierarchy

```
App (layout wrapper)
├── Navbar (public routes)
├── GradientBackground (global overlay)
└── Routes
    ├── Landing (public landing page)
    ├── Login (auth form)
    ├── Register (registration form)
    └── PrivateRoute (auth guard)
        ├── Dashboard (main app - 791 lines)
        └── Profile (user profile page)
```

**Dashboard Sub-Components:**

- SearchField (search input + dropdown)
- ItemsList (note navigation list)
- ItemCard (note list item)
- BlockMenu (hover menu for block operations)
- Button, InputField (reusable UI components)

### Routing Structure

**Public Routes (unprotected):**

- `/` - Landing page
- `/login` - Login form
- `/register` - Registration form

**Private Routes (authenticated):**

- `/dashboard` - Main app view (root path)
- `/dashboard/*` - Nested note navigation
- `/profile` - User profile page

**Auth Guard:**

- `PrivateRoute` component wraps protected routes
- Checks localStorage for JWT token
- Redirects to `/login` if no token
- Token persisted across sessions

### State Management

**Current Approach (to be improved):**

- Local state in components via React hooks
- No global state management
- API data fetched per-component
- Token stored in localStorage
- No caching or optimistic updates
- React Router for URL-based state

**State Patterns:**

- **Dashboard:** 15+ useState hooks for different aspects
- **SearchField:** Local state for query, results, loading, focus
- **BlockMenu:** Local state for menu visibility, options
- No shared state between components
- No context providers

### API Communication Pattern

**Fetch Helper:**

```javascript
const token = localStorage.getItem("token");
const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await response.json();
```

**Error Handling:**

- Check `response.ok`
- Parse JSON error messages
- Handle 401 by clearing token and redirecting to login
- Set error state for UI display

**No Abstraction:**

- Each component makes its own API calls
- No centralized API client
- No request/response interceptors
- No retry logic

---

## 6. Core Components

### Dashboard (791 lines - PRIMARY REFACTOR TARGET)

**Responsibilities (to be split):**

1. **Navigation:** Handle URL path changes, navigate between notes
2. **Data Fetching:** Fetch all notes for navigation, fetch current note for editing
3. **Path Logic:** Calculate parent/child notes based on current path depth
4. **Note Creation:** Create new notes with auto-naming (new-note, new-note-2, etc.)
5. **Note Editing:** Update title, path, blocks
6. **Note Deletion:** Delete current note, navigate to parent
7. **Block Management:** Add, delete, reorder blocks
8. **UI State:** Drawer toggle, loading states, error states
9. **Mobile/Desktop Layout:** Responsive navigation sidebar
10. **Search Integration:** Pass search results to navigation

**State Variables (15+):**

- `currentNote` - loaded note data
- `allNotes` - all user's notes (for navigation)
- `pathNotes` - child notes at current level
- `parentNotes` - parent directory notes
- `isLoading` - loading state
- `error` - error message
- `newParagraph` - buffer for adding new paragraph block
- `isDrawerOpen` - settings drawer visibility
- `isMobileMenuOpen` - mobile menu visibility
- `activeMenuIndex` - which block menu is active
- `parentDirForCreateContext` - path context for creating new notes

**Key Functions:**

- `fetchAllNotes()` - fetch all notes for navigation
- `fetchNoteByPath(path)` - load specific note
- `createNewNote(parentPathSegment)` - create note at path
- `updateExistingNote(path, updateData)` - partial update
- `deleteCurrentNote()` - delete and navigate away
- `handleMoveBlock(index, direction)` - reorder blocks
- `handleAddBlockAfter(index, blockType)` - insert block
- `handleDeleteBlock(index)` - remove block

**Layout Structure:**

- Top navbar (desktop + mobile variants)
- Left sidebar (parent directory notes)
- Center content area (editor + settings drawer)
- Right sidebar (child notes at current level)
- Mobile menu drawer (full-screen on mobile)

### SearchField (211 lines)

**Responsibilities:**

1. Search input with debounce (500ms delay)
2. API call to search endpoint
3. Dropdown results display
4. Click-outside-to-close behavior
5. Loading and error states

**Key Features:**

- Debounced search (500ms) to avoid excessive API calls
- Auto-focus results on input focus
- Show loading spinner during search
- Display error messages
- Clear results on empty query
- Click result to navigate and clear search

**State Variables:**

- `query` - search input value
- `searchResults` - array of search results
- `isFocused` - input focus state
- `isPopoutVisible` - dropdown visibility
- `isLoading` - API loading state
- `error` - error message

### BlockMenu (138 lines)

**Responsibilities:**

1. Hover-activated menu for each block
2. Move block up/down
3. Add new block (paragraph, heading, divider)
4. Delete block
5. Nested menu for block type selection

**Interaction Pattern:**

- Menu appears on hover over block area
- Disappears after 200ms delay on leave
- Clicking menu items keeps menu visible
- Add button shows nested submenu

**State Variables:**

- `showAddOptions` - nested add menu visibility

### ItemsList (26 lines)

**Responsibilities:**

1. Display list of notes at current navigation level
2. "Create new note" button at top
3. Highlight currently selected note

**Props:**

- `currentPath` - current URL path
- `items` - array of notes to display
- `createNote` - callback to create new note

### UI Components

**Button & ButtonLink:**

- Three color variants: rose, blue, green
- Noise texture overlay
- Custom shadows (button, pressed-button)
- Active state scale animation

**InputField:**

- Noise texture overlay
- Focus state with custom shadow
- Hover state transition
- Placeholder styling

**GradientBackground:**

- Fixed full-screen overlay
- Linear gradient (purple → yellow → purple)
- Noise texture overlay
- Semi-transparent white overlay for readability

---

## 7. User Flows

### Registration Flow

1. User visits `/register`
2. Enters username and password (twice for confirmation)
3. Frontend validates passwords match
4. POST to `/api/register`
5. On success: Show success message
6. User navigates to `/login`

### Login & Authentication Flow

1. User visits `/login`
2. Enters username and password
3. POST to `/api/login`
4. On success: Store token and username in localStorage
5. Redirect to `/dashboard`
6. All subsequent requests include `Authorization: Bearer <token>`

### Dashboard Navigation Flow

1. User loads `/dashboard` (root path)
2. App fetches all notes via GET `/api/notes`
3. Display root-level notes (depth 1)
4. User clicks note → navigate to `/dashboard/note-path`
5. App loads specific note via GET `/api/notes/note-path`
6. Left sidebar shows parent directory notes
7. Right sidebar shows child notes at current level
8. User navigates by clicking notes in sidebars

### Note Creation Flow

1. User clicks "Create note" in sidebar
2. App generates path based on current context
3. Base name: `new-note`
4. If exists, increment: `new-note-2`, `new-note-3`, etc.
5. POST to `/api/notes` with empty title and empty blocks
6. Navigate to new note path
7. Refresh all notes list
8. User can edit title and blocks

### Note Editing Flow

1. User types in text area (auto-expands via grid trick)
2. Content updates in local state (optimistic UI)
3. On blur: Send PUT to `/api/notes/path` with updated blocks
4. Title edited in settings drawer, updates on blur
5. Block operations via hover menu (move, add, delete)
6. All block operations send PUT with updated blocks array

### Search Flow

1. User types in search field
2. 500ms debounce delay
3. GET `/api/notes/search?q=<query>`
4. Show loading spinner
5. Display results dropdown (top 5)
6. Click result → navigate to note, clear search
7. Click outside → close dropdown

### Note Management Flow

1. User clicks menu button (top right of editor)
2. Settings drawer opens
3. User can edit title (updates on blur)
4. User can delete note (with confirmation)
5. On delete: Navigate to parent directory, refresh notes list

---

## 8. Key Algorithms

### Path Navigation Algorithm

**Purpose:** Determine which notes to show in left (parent) and right (child) sidebars based on current path.

**Logic:**

1. Parse current path into segments: `/work/project` → `['work', 'project']`
2. Calculate current depth: number of segments
3. **Child notes:** Filter notes where depth = current depth + 1 AND path starts with current path + `/`
4. **Parent notes:**
   - If depth = 0: No parent, show root notes (depth 1)
   - If depth = 1: Show root notes (depth 1)
   - If depth > 1: Navigate up 2 levels, show notes at that depth
5. **Create context:** If depth = 0, create at root; if depth = 1, create at root; else, create at grandparent path

**Example:**

- Current: `/work/project/tasks`
- Segments: `['work', 'project', 'tasks']`, depth = 3
- Child depth: 4, prefix: `/work/project/tasks/`
- Parent context: `['work']`, depth 1, prefix: `/`
- Parent notes: All depth 1 notes starting with `/`
- Create context: `work` (for creating sibling of `tasks`)

### Note Naming Algorithm

**Purpose:** Generate unique path when creating new notes.

**Logic:**

1. Base name: `new-note`
2. Base path: `{currentContext}/new-note`
3. Check if path exists in allNotes array
4. If not exists, use base path
5. If exists, increment: `{currentContext}/new-note-2`
6. Keep incrementing until unique path found
7. Create note at generated path

**Example:**

- Context: `/work`
- Check `/work/new-note` → exists
- Check `/work/new-note-2` → exists
- Check `/work/new-note-3` → free, use this

### Search Algorithm

**Purpose:** Find notes containing search query in block content.

**Logic:**

1. Escape regex special characters in query
2. Build regex: `new RegExp(query, 'i')` (case-insensitive)
3. Query MongoDB: Find notes where blocks array contains element with matching content
4. Match on `paragraph` and `heading_one` block types only
5. Sort by `updatedAt` descending
6. Limit to 5 results
7. Return note metadata only (title, path, timestamps), not full blocks

**Performance Note:** This is slow on large datasets. Regex on array elements scans entire collection.

### Block Reordering Logic

**Purpose:** Move blocks up or down in the editor.

**Logic:**

1. Clone blocks array
2. Swap current index with neighbor (index - 1 for up, index + 1 for down)
3. Check bounds (can't move first block up, can't move last block down)
4. Update local state (optimistic)
5. Send PUT request with new blocks array
6. Rollback on error

---

## 9. UI/UX Design System

### Color Palette

**Primary Colors:**

- Stone (neutral): Backgrounds, text (`text-stone-700`, `bg-stone-50`)
- Rose (accent): Primary actions, errors (`text-rose-700`, `hover:bg-rose-400`)
- Yellow/Orange: Gradients, branding (`from-yellow-900`, `to-rose-900`)
- Blue: Secondary actions (`hover:bg-blue-400`)
- Green: Success actions (`hover:bg-emerald-400`)

**Opacity Levels:**

- `/85` for main text
- `/70` for secondary text
- `/50` for placeholder text
- `/90` for backgrounds

### Noise Texture Implementation

**Technique:** SVG filters applied via CSS

**Pattern:**

1. Define `feTurbulence` filter with `fractalNoise` type
2. Apply filter to SVG rectangles
3. Overlay on UI elements (buttons, inputs, backgrounds)
4. Use `bg-blend-overlay` for noise layering
5. Vary opacity for subtle vs. prominent textures

**Usage:**

- Buttons: `opacity-15` noise overlay
- Inputs: `opacity-10` noise overlay
- Background: `opacity-30` global noise

### Custom Shadows

**Defined in Tailwind theme:**

- `--shadow-button`: Inset highlight + outer shadow
- `--shadow-pressedbutton`: Inset shadows for active state
- `--shadow-input`: Soft drop shadow
- `--shadow-inputfocus`: Focus ring with accent color
- `--shadow-box`: Large shadow for main container (inset highlight + large drop shadow)

**Usage:**

- Buttons: `shadow-button` → `active:shadow-pressedbutton`
- Inputs: `shadow-input` → `focus:shadow-inputfocus`
- Main editor: `shadow-box`

### Typography & Spacing

**Font:** System sans-serif (browser default)

**Sizes:**

- Headings: `text-2xl`, `text-4xl`, `text-7xl`
- Body: `text-sm`, `text-lg`, `text-xl`
- Labels: `text-lg font-semibold`

**Font Weights:**

- Bold: `font-black`, `font-semibold`
- Normal: Unspecified (default)

**Spacing:**

- Padding: `py-2`, `px-2` (tight), `py-8`, `px-8` (loose)
- Margins: `mb-2`, `mb-4`, `mb-8`
- Gaps: `gap-2`, `gap-4`

### Responsive Design Strategy

**Desktop (xl: 1280px+):**

- Three-column layout
- Left sidebar (parent notes)
- Center editor
- Right sidebar (child notes)
- Top navbar with search
- Desktop-only: Full navigation and controls

**Mobile (default):**

- Single-column layout
- Collapsible mobile menu (full-screen overlay)
- Hamburger menu button
- Simplified navigation
- Bottom-safe-area padding for mobile browsers
- Touch-friendly tap targets

**Breakpoints:**

- `xl:` - Desktop enhancements
- `md:` - Medium adjustments (padding)
- Default - Mobile-first design

### Animation & Transitions

**Standard Transitions:**

- `duration-75` - Fast interactions (buttons, inputs)
- `duration-150` - Medium interactions (hover, menu appear)
- `duration-300` - Slow interactions (drawer, mobile menu)
- `ease-out` - Natural feel

**Animations:**

- `animate-pulse` - Loading states
- `animate-spin` - Loading spinner
- `active:scale-95` - Button press feedback

---

## 10. Known Issues & Technical Debt

### Critical Issues

1. **Component Monolith:** Dashboard component is 791 lines, handles 10+ responsibilities. This makes it nearly impossible to maintain, test, or modify safely.

2. **No TypeScript:** Pure JavaScript with no type checking. Props are unvalidated, API responses are untyped. Easy to introduce bugs that only show at runtime.

3. **Custom Auth Implementation:**
   - JWT stored in localStorage (XSS vulnerability)
   - No refresh tokens (forced logout after 1 hour)
   - No token rotation
   - Manual middleware implementation
   - No session management

4. **No Centralized State Management:**
   - Each component fetches its own data
   - No caching (API called repeatedly)
   - No optimistic updates
   - No shared state between components
   - API logic duplicated

5. **No Validation Layer:**
   - Client-side: Basic length checks only
   - Server-side: Mongoose validation only
   - No input sanitization
   - No consistent error messages
   - No Zod or similar schema validation

### Performance Issues

6. **No Pagination:** GET `/api/notes` fetches ALL user's notes. Will break as user scales.

7. **Slow Search:** Regex search on large arrays in MongoDB. No text search index. No result relevance scoring.

8. **Unoptimized Renders:** Dashboard re-renders on every state change. Only ItemCard uses React.memo.

9. **No Code Splitting:** Single bundle. All code loaded upfront.

### Code Quality Issues

10. **Inconsistent Error Handling:**
    - Some errors logged to console
    - Some displayed in UI
    - Some silent failures
    - No error boundaries
    - No retry logic

11. **Hard-coded Values:**
    - Debounce delay: 500ms (magic number)
    - Search limit: 5 results
    - Path prefix: `/`
    - Russian text hardcoded (no i18n)

12. **Magic Numbers:** Repeated hardcoded values throughout (timeouts, limits, padding).

13. **Mixed Languages:** UI text in Russian, code comments in English, variable names in English. No i18n.

14. **No Logging:** Only console.log/console.error for debugging. No structured logging.

15. **No Tests:** Zero unit tests, integration tests, or E2E tests.

16. **No Linting Rules:** ESLint config minimal. No code style enforcement.

17. **Unused Dependencies:** Some packages imported but not used effectively.

### Architecture Issues

18. **SPA Limitations:** Client-side routing causes issues with deep linking, SEO, and initial load.

19. **No API Abstraction:** Fetch calls scattered throughout components. No centralized API client.

20. **Tight Coupling:** Dashboard knows about everything (API, routing, state, UI). Hard to modify one aspect without breaking others.

21. **No Separation of Concerns:** Business logic mixed with UI logic mixed with data fetching.

---

## 11. Migration Strategy for v2.0

### Backend Migration: Fastify → Next.js API Routes

**Why:**

- Unified framework (Next.js handles both frontend and backend)
- Better TypeScript support out of the box
- Easier deployment (single deployment target)
- Better performance (shared code, no cold starts for serverless)
- Built-in optimizations (middleware, caching, compression)

**Architectural Decisions:**

- Replace Fastify routes with Next.js App Router API routes (`app/api/*`)
- Use Next.js middleware for auth checks
- Leverage Next.js caching strategies
- Implement proper HTTP status codes and error handling
- Use TypeScript for all API handlers

**Migration Steps:**

1. Set up Next.js App Router structure
2. Create API route handlers mirroring Fastify routes
3. Implement middleware for JWT validation
4. Migrate database connection (MongoDB → PostgreSQL)
5. Update environment variable handling
6. Test each endpoint independently

### Database Migration: MongoDB → PostgreSQL

**Why:**

- Structured schema prevents data inconsistencies
- Better performance for relational queries (path hierarchy, user-notes)
- Full-text search built-in and fast
- ACID transactions for data integrity
- Better TypeScript support (drizzle)

**Architectural Decisions:**

- Use drizzle ORM for type-safe database access
- Design normalized schema (users, notes, blocks tables)
- Add foreign key constraints
- Implement cascading deletes
- Use PostgreSQL full-text search for search functionality
- Add proper indexes for common queries

**Schema Design (PostgreSQL):**

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Notes table
CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, path)
);

-- Blocks table
CREATE TABLE blocks (
  id SERIAL PRIMARY KEY,
  note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  content TEXT,
  position INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notes_user_path ON notes(user_id, path);
CREATE INDEX idx_blocks_note_position ON blocks(note_id, position);
CREATE INDEX idx_notes_updated ON notes(updated_at DESC);

-- Full-text search
CREATE INDEX idx_blocks_content_search ON blocks USING GIN(to_tsvector('english', content));
```

**Migration Steps:**

1. Set up drizzle with PostgreSQL
2. Define schema in drizzle schema
3. Run migrations to create tables
4. Update all API queries to use drizzle
5. Test search functionality with PostgreSQL FTS
6. Verify data integrity

### Auth Migration: Custom JWT → betterauth

**Why:**

- Industry-standard authentication library
- Built-in refresh tokens
- Session management out of the box
- Support for OAuth providers (Google, GitHub, etc.)
- Better security practices
- TypeScript support
- No need to maintain custom auth logic

**Architectural Decisions:**

- Use betterauth with PostgreSQL adapter
- Implement session-based auth with JWT fallback
- Use secure HTTP-only cookies for tokens (no localStorage)
- Implement refresh token rotation
- Add email verification flow (optional)
- Support password reset flow (optional)

**Migration Steps:**

1. Install and configure betterauth
2. Create auth tables in PostgreSQL (auto-generated)
3. Update user model to match betterauth schema
4. Implement auth routes using betterauth handlers
5. Migrate frontend to use betterauth client
6. Update token storage (cookies instead of localStorage)
7. Test login, logout, session refresh flows
8. Remove custom JWT implementation

### Frontend Migration: React SPA → Next.js App Router

**Why:**

- Server-side rendering for better performance and SEO
- File-based routing (no React Router config)
- Built-in optimizations (code splitting, image optimization, font optimization)
- Better TypeScript integration
- Unified codebase with backend
- Easier deployment

**Architectural Decisions:**

- Use Next.js App Router (not Pages Router)
- Implement server components by default, client components only when needed
- Use React Server Components for data fetching
- Use Server Actions for mutations
- Leverage Next.js caching for data fetching
- Use shadcn/ui or similar component library (rebuild custom components)

**Migration Steps:**

1. Set up Next.js App Router project
2. Create route structure mirroring React Router
3. Convert pages to server components
4. Implement data fetching in server components
5. Convert interactive components to client components
6. Implement Server Actions for mutations
7. Migrate custom UI components (buttons, inputs)
8. Add loading states (Suspense)
9. Test all user flows
10. Remove React Router dependency

### State Management Migration: Add React Query

**Why:**

- Automatic caching and invalidation
- Optimistic updates
- Background refetching
- DevTools for debugging
- Better TypeScript support
- Less boilerplate than custom fetching

**Architectural Decisions:**

- Use TanStack Query (React Query) for server state
- Use Zustand or Context for client UI state
- Keep auth state in betterauth client
- Cache API responses automatically
- Implement optimistic updates for block operations
- Invalidate relevant queries on mutations

**Migration Steps:**

1. Install and configure TanStack Query
2. Create query client and provider
3. Convert all fetch calls to useQuery hooks
4. Create custom hooks for common queries (fetchNotes, fetchNote)
5. Implement useMutation for mutations (create, update, delete)
6. Add optimistic updates for block operations
7. Set up automatic cache invalidation
8. Remove manual state management for API data
9. Test loading/error states

### Validation Migration: Add Zod

**Why:**

- Runtime type checking
- Compile-time type inference (with TypeScript)
- Centralized validation schemas
- Better error messages
- Input sanitization
- API request/response validation

**Architectural Decisions:**

- Define Zod schemas for all data models (User, Note, Block)
- Validate all API requests on server side
- Validate all API responses on client side
- Use Zod to infer TypeScript types
- Implement form validation with Zod (react-hook-form)
- Use Zod for environment variable validation

**Migration Steps:**

1. Create Zod schemas for User, Note, Block
2. Validate API requests in Next.js route handlers
3. Validate API responses on client side
4. Infer TypeScript types from Zod schemas
5. Replace manual validation with Zod schemas
6. Implement form validation with Zod
7. Test validation edge cases
8. Remove manual validation logic

---

## 12. What NOT to Carry Forward (Anti-Patterns)

### Code Structure Anti-Patterns

1. **Monolithic Components (NEVER DO THIS):**
   - Dashboard: 791 lines handling 10+ responsibilities
   - Instead: Split into focused components (NoteEditor, Navigation, Sidebar, Toolbar)

2. **Prop Drilling:**
   - Passing state through 5+ component levels
   - Instead: Use Context API or Zustand for shared state

3. **State Scattered Everywhere:**
   - Each component fetching its own data
   - Instead: Centralize API data fetching with React Query

4. **Inline API Calls:**
   - Fetch calls scattered throughout components
   - Instead: Create reusable API hooks (`useNotes`, `useNote`, `useCreateNote`)

5. **Mixed Concerns:**
   - UI components making API calls
   - Instead: Separate UI from business logic

### Security Anti-Patterns

6. **JWT in localStorage (CRITICAL):**
   - Vulnerable to XSS attacks
   - Instead: Use HTTP-only cookies (betterauth handles this)

7. **Custom Auth Implementation:**
   - Building auth from scratch
   - Instead: Use battle-tested library (betterauth)

8. **No Input Sanitization:**
   - Trusting user input
   - Instead: Validate and sanitize all inputs (Zod)

9. **Exposing User IDs in URLs:**
   - `/user/123/notes`
   - Instead: Use session-based auth, hide IDs

### Performance Anti-Patterns

10. **Fetching All Data:**
    - Loading all notes at once
    - Instead: Implement pagination or infinite scroll

11. **Regex Search on Large Datasets:**
    - Scanning entire collection
    - Instead: Use PostgreSQL full-text search with indexes

12. **Unnecessary Re-renders:**
    - Component re-renders on unrelated state changes
    - Instead: Use React.memo, useMemo, useCallback appropriately

13. **No Code Splitting:**
    - Loading all code upfront
    - Instead: Next.js automatic code splitting

### Error Handling Anti-Patterns

14. **Inconsistent Error Handling:**
    - Some errors logged, some displayed, some ignored
    - Instead: Centralized error handling (Error boundaries, toast notifications)

15. **Silent Failures:**
    - API calls failing without user feedback
    - Instead: Always inform user, offer retry

16. **No Error Boundaries:**
    - One error crashes entire app
    - Instead: Wrap routes in error boundaries

### Testing Anti-Patterns

17. **No Tests (CRITICAL):**
    - Zero test coverage
    - Instead: Unit tests for utilities, integration tests for API, E2E for user flows

18. **Testing Only Happy Paths:**
    - Ignoring error cases
    - Instead: Test edge cases, error states, loading states

19. **Fragile Tests:**
    - Tests break on UI changes
    - Instead: Test business logic, not implementation details

### Database Anti-Patterns

20. **No Cascading Deletes:**
    - Deleting user leaves orphaned notes
    - Instead: Use foreign key constraints with ON DELETE CASCADE

21. **Duplicate Logic in App:**
    - Calculating relationships in code instead of DB
    - Instead: Use database queries for filtering, sorting

22. **No Transactions:**
    - Multiple independent queries that should be atomic
    - Instead: Wrap related operations in transactions

### Logging Anti-Patterns

23. **console.log in Production:**
    - Debug statements left in code
    - Instead: Use structured logging library (pino, winston)

24. **No Error Tracking:**
    - Errors only visible in console
    - Instead: Integrate Sentry or similar error tracking

25. **No Performance Monitoring:**
    - No visibility into app performance
    - Instead: Add monitoring (Vercel Analytics, Google Analytics)

### Code Quality Anti-Patterns

26. **Magic Numbers:**
    - Hardcoded values (500, 5, '/new-note')
    - Instead: Define constants in config file

27. **Mixed Languages:**
    - Russian UI text, English code, mixed comments
    - Instead: Use i18n library for UI, English for code/comments

28. **Inconsistent Naming:**
    - `userName`, `user_name`, `Username`
    - Instead: Follow consistent naming convention (camelCase for JS, snake_case for DB)

29. **Comments That Lie:**
    - Outdated comments contradicting code
    - Instead: Keep comments up to date, prefer self-documenting code

### Deployment Anti-Patterns

30. **No Environment Validation:**
    - App crashes if env var missing
    - Instead: Validate env vars on startup (Zod)

31. **Hardcoded URLs:**
    - `localhost:5173` in code
    - Instead: Use environment variables, relative URLs

32. **No Deployment Pipeline:**
    - Manual deploy, no CI/CD
    - Instead: Automate with GitHub Actions, Vercel, Netlify

---

## 13. Mature Project Practices (Brief Guide)

### Logging

**What to Log:**

- All API errors with context (user ID, request details)
- Business logic failures
- Performance metrics (slow queries, slow endpoints)
- Security events (failed logins, suspicious activity)

**How to Log:**

- Use structured logging (JSON format)
- Include: timestamp, level, message, context
- Different log levels: error, warn, info, debug
- Send to centralized service (Sentry, LogRocket, DataDog)

**Implementation:**

```typescript
import { logger } from "./lib/logger";

logger.error("Note creation failed", {
  userId,
  error: error.message,
  stack: error.stack,
});

logger.info("User logged in", { userId, timestamp });
```

### Testing

**Unit Tests:**

- Test utility functions (path parsing, naming logic)
- Test business logic (block operations, search algorithms)
- Fast, no external dependencies
- Use Vitest or Jest

**Integration Tests:**

- Test API endpoints
- Test database queries
- Test auth flows
- Use Supertest (for API) or Playwright

**E2E Tests:**

- Test complete user flows (register → login → create note → search → delete)
- Test critical paths only
- Use Playwright or Cypress

**Coverage Goal:**

- Minimum 80% code coverage
- 100% for critical paths (auth, data operations)

### Error Handling

**Frontend:**

- Error boundaries to catch component errors
- Toast notifications for user feedback
- Retry buttons for recoverable errors
- Fallback UI for failed loads

**Backend:**

- Consistent error responses (status codes, messages)
- Error logging with context
- Graceful degradation
- Rate limiting for repeated errors

**Implementation:**

```typescript
// Frontend
<ErrorBoundary fallback={<ErrorFallback />}>
  <Dashboard />
</ErrorBoundary>

// Backend
try {
  await createNote(data);
} catch (error) {
  logger.error('Failed to create note', { error, data });
  throw new APIError('Could not create note', 500);
}
```

### Type Safety

**TypeScript Configuration:**

- Strict mode enabled
- No implicit any
- No unused variables
- All API responses typed
- All database models typed

**Zod for Runtime Validation:**

- Validate all inputs (forms, API requests)
- Infer types from schemas
- Better error messages
- Sanitization built-in

### Performance Monitoring

**What to Monitor:**

- Page load times
- API response times
- Database query times
- Error rates
- User engagement metrics

**Tools:**

- Vercel Analytics (performance, user metrics)
- Sentry (error tracking, performance)
- Postgres Query Stats (slow queries)

### CI/CD Pipeline

**Stages:**

1. Linting (ESLint)
2. Type checking (tsc)
3. Testing (unit, integration, E2E)
4. Build (production build)
5. Deploy (automatic on merge to main)

**Checks:**

- All tests pass
- No TypeScript errors
- No linting errors
- Build succeeds
- Deployment completes

### Code Review Standards

**What to Review:**

- Logic correctness
- Security vulnerabilities
- Performance implications
- Code readability
- Test coverage
- Documentation

**Checklist:**

- [ ] Tests added/updated
- [ ] Types are correct
- [ ] No security issues
- [ ] No performance regressions
- [ ] Code is readable
- [ ] Documentation updated

### Documentation

**What to Document:**

- Architecture decisions (why we did X)
- API endpoints (request/response schemas)
- Data models (schemas, relationships)
- User flows (step-by-step)
- Setup instructions (how to run locally)
- Deployment process (how to deploy)

**Keep It Current:**

- Update docs when code changes
- Document WHY, not just WHAT
- Use diagrams for complex flows
- Keep it concise but complete

---

## 14. Feature Gaps & Future Improvements

### Core Features Missing

1. **Real-time Collaboration:**
   - WebSocket support
   - Operational Transformation or CRDT for conflict resolution
   - Live cursor positions
   - User presence indicators

2. **Rich Text Formatting:**
   - Bold, italic, underline
   - Lists (ordered, unordered)
   - Code blocks with syntax highlighting
   - Images, links, mentions
   - Use Tiptap, Slate.js, or similar editor library

3. **Tags & Categories:**
   - Tag notes for organization
   - Filter by tags
   - Multiple tags per note
   - Tag auto-completion

4. **Note Sharing:**
   - Share notes with other users
   - Permission levels (view, edit, admin)
   - Public sharing with link
   - Collaboration features (comments, @mentions)

5. **Version History:**
   - Track all changes
   - View past versions
   - Restore from history
   - Compare versions

6. **Offline Support:**
   - Service worker for caching
   - IndexedDB for local storage
   - Sync when back online
   - Offline-first architecture

7. **Export/Import:**
   - Export to Markdown, PDF, HTML
   - Import from other apps (Notion, Evernote)
   - Backup/restore data

### UX Improvements

8. **Keyboard Shortcuts:**
   - Cmd/Ctrl + K for search
   - Cmd/Ctrl + S for save
   - Cmd/Ctrl + N for new note
   - Arrow keys for navigation

9. **Drag & Drop:**
   - Drag blocks to reorder
   - Drag notes to move paths
   - Visual feedback during drag

10. **Command Palette:**
    - Cmd/Ctrl + P to open
    - Search commands and notes
    - Quick actions
    - Like VS Code command palette

11. **Dark Mode:**
    - Theme toggle
    - System preference detection
    - Persist theme choice

12. **Better Mobile Experience:**
    - Bottom navigation bar
    - Swipe gestures
    - Touch-friendly interactions
    - PWA support (installable)

### Developer Features

13. **API Rate Limiting:**
    - Prevent abuse
    - User-based limits
    - Exponential backoff

14. **Webhooks:**
    - Notify external services on note changes
    - Automations and integrations

15. **Plugin System:**
    - Allow third-party extensions
    - Custom block types
    - Custom themes

16. **Analytics:**
    - Track user behavior
    - Identify pain points
    - Improve features based on data

---

## Summary

This document captures the complete essence of Grainy Notes v1.0, including all architectural decisions, data structures, user flows, and anti-patterns to avoid in the rewrite.

**Key Takeaways for v2.0:**

1. **Preserve the Path System:** The hierarchical folder navigation is the core differentiator and works well.

2. **Preserve the Block Editor Concept:** But use a proper library (Tiptap, Slate.js) instead of custom implementation.

3. **Preserve the Aesthetic:** Noise textures and custom design language are unique and valuable.

4. **Radically Refactor Architecture:** Break monolithic components, add state management, implement proper auth, migrate to PostgreSQL.

5. **Add Mature Practices:** Logging, testing, error handling, CI/CD, monitoring.

6. **Use Battle-Tested Libraries:** betterauth, React Query, Zod, drizzle, Next.js.

7. **Learn from Anti-Patterns:** This document lists 32 specific things NOT to do.

8. **Think About Scale:** Pagination, search optimization, caching from the start.

The rewrite should focus on clean architecture, type safety, and scalability while preserving the unique user experience that makes Grainy Notes special.

---

**End of Documentation**

Generated: January 20, 2026
For: Grainy Notes v2.0 Rewrite (Next.js, TypeScript, PostgreSQL, betterauth)
