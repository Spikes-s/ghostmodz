# Wave 1 — Platform Refinement

Scope is intentionally bounded. Version history, live collaboration, project templates, help center, and settings reorganization move to Wave 2.

## 1. Global Search + Command Palette (Ctrl/Cmd+K)

Single component powering both. Opens with `Cmd/Ctrl+K` or via a search bar in the Navbar.

- New `src/components/ghost/CommandPalette.tsx` using shadcn `Command` primitive.
- New `src/lib/search-index.functions.ts` server function that queries in parallel:
  - `services` (name, slug)
  - `conversations` (title, last message) — user's own
  - `projects` + `api_projects` + `website_requests` — user's own
  - `project_files` (name) — scoped to user's projects
  - `notifications` (title/body) — unread first
  - Static: settings pages, admin pages (if admin), documentation links
- Debounced query (200ms), returns grouped results with icons and route targets.
- Mounted globally in `_authenticated/route.tsx`; keyboard listener registers once.
- Navbar gets a compact search input on desktop (`hidden md:flex`) that focuses the palette.

## 2. Quick Action floating button

- New `src/components/ghost/QuickActions.tsx` — floating button beside `ChatBubble` (bottom-left so it doesn't collide).
- Radial/popup menu with links: Spikes, Build, Workspace (build), Terminal, Preview (last project), Notifications, Deploy (opens publish info).
- Hidden on `/auth`, `/support`, and admin pages.

## 3. Homepage dashboard: Continue Working + Favorites + Recent

Edit `src/routes/_authenticated/index.tsx`:
- New "Continue Working" hero card showing the most recently modified project (across `projects`, `api_projects`, `website_requests`) with Resume button.
- "Recent" horizontal strip (last 6).
- "Favorites" section.
- Add `is_favorite boolean default false` column to `projects` and `api_projects` via migration (plus GRANT + RLS already inherited). Star toggle on project cards.

## 4. Notification center improvements

- Extend existing `NotificationBell` popover with filter tabs (All / Unread / Messages / System) and an unread badge on the Navbar bell already exists — keep it.
- Add "Mark all read" and "Clear read" buttons.
- No schema changes.

## 5. Workspace polish

Edit build workspace (`src/routes/_authenticated/build.$projectId.tsx`):
- Right-click context menu on files (Rename, Duplicate, Delete, New File, New Folder) using shadcn `ContextMenu`.
- Drag-and-drop file reordering (HTML5 DnD, no new dep).
- Split-screen toggle: Editor | Preview toggleable via a header button (already-present preview panel; just wire a layout mode state).
- Project settings sheet: name, description, framework badge, version, owner, last modified.

## 6. Performance sweep

- Router: enable `defaultPreload: "intent"` already set — audit heavy routes and add `lazy` component imports for admin.* files.
- Add `React.lazy` + Suspense around Monaco editor and Markdown renderer (already CDN-loaded but reduce initial parse).
- Add `loading="lazy"` and `decoding="async"` to all `<img>` tags in home/services pages.
- Ensure `staleTime` is set on all `useQuery` calls that currently omit it (services list, notifications list — already good; audit others).
- Convert any inline `new Date()` sort helpers used per-render into memoized results.

## 7. QA pass (targeted, not exhaustive)

- Mobile layout check: Navbar collapse threshold moved from `lg` → `md` on some tabs; verify pages don't overflow at 375px.
- Broken link audit: grep for hardcoded routes and confirm each `<Link to>` target exists in `routeTree.gen.ts`.
- Consistent loading skeletons: replace 3–4 remaining spinner placeholders with `Skeleton`.
- Branded loading screen: new `src/components/ghost/BrandedLoader.tsx` used by Suspense fallbacks.

## Out of scope (Wave 2)

Version history / restore points, project templates, live collaboration UI, activity timeline persistence, categorized settings reorg, help center, AI code-explain features. I'll open a Wave 2 plan after this ships.

## Technical notes

- No new npm packages required (shadcn `command`, `context-menu` already registered or will be added via CLI).
- One DB migration: `is_favorite` columns.
- All new server functions use `requireSupabaseAuth`; all admin-only paths guarded via `has_role`.
- No changes to auth, RLS on existing tables, or edge functions.

## Delivery order

1. Migration + shadcn `command`/`context-menu` install
2. `search-index.functions.ts` + `CommandPalette` (mounted globally, keyboard shortcut, Navbar search input)
3. `QuickActions` floating menu
4. Dashboard rewrite (Continue / Recent / Favorites)
5. Notification filter tabs
6. Workspace context menu + split-screen toggle + project settings sheet
7. Perf audit + BrandedLoader + mobile QA sweep
8. Build verification
