## Scope

Two big features on top of the existing Ghost Mods Tech app:

1. **AI Customer Support** layered on the existing `support_threads` / `support_messages` chat.
2. **API Development Platform** — a new service with a guided workspace, plus admin visibility.

Both keep the current cyberpunk look (glass cards, neon purple/blue, dark mode) and stay inside the existing TanStack Start + Lovable Cloud + Lovable AI stack.

---

## 1. AI Customer Support

### Data (one migration)
- Extend `support_threads`:
  - `ai_enabled boolean default true`
  - `admin_active boolean default false` (set true when an admin sends a message, cleared by admin toggle)
  - `language text` (last detected)
  - `status text default 'open'` (open / escalated / closed)
- Extend `support_messages`:
  - `sender_role` already exists; add `'ai'` as an accepted value.
  - `language text nullable`
- New `ai_support_settings` (singleton row, admin-only write, authenticated read):
  - `ai_globally_enabled`, `welcome_message`, `business_description`, `business_hours`, `contact_details`, `faqs jsonb`, `response_style`, `max_response_length`, `supported_languages text[]`, `escalation_rules`
- Grants + RLS per project conventions.

### Server
- `src/lib/ai-support.functions.ts`
  - `getAiSupportSettings` (auth)
  - `updateAiSupportSettings` (admin, via `has_role`)
  - `setThreadAiEnabled({ threadId, enabled })` (admin)
  - `generateAiReply({ threadId })` — auth, called by the client after a visitor message when `ai_enabled && !admin_active && ai_globally_enabled`. Loads settings + last ~20 messages, calls Lovable AI Gateway (`openai/gpt-5.5`) with a system prompt built from settings, detects language, inserts an `ai` message row.
- Admin-sent message trigger already flips `admin_active = true` via a small update inside `sendMessage` when `sender_role === 'admin'`.

### UI
- **Visitor side (`support.tsx`)**: after `sendMessage` resolves, if thread has `ai_enabled` and no `admin_active`, call `generateAiReply`. Show "AI Assistant" label on ai messages, "Admin" on admin. Header badge: "AI is answering" / "Live agent".
- **Admin side (`admin.support.tsx`)**: per-thread toggle "AI Reply" (calls `setThreadAiEnabled`), visible indicator, "Take over" button that disables AI. Existing thread list + realtime works.
- **New admin page `admin.ai-settings.tsx`** with the settings form (welcome, business info, FAQs list, style, max length, languages multi-select, escalation rules, global AI toggle). Linked from `admin.tsx` tabs.
- Notifications: reuse existing `notifications` table — insert a row when a new thread is created or when AI escalates (falls back to admin).

### Languages
- Model detects language from user text; system prompt instructs "reply in the visitor's language if it is one of {supported_languages}, otherwise reply in English politely acknowledging the limitation."

---

## 2. API Development Platform

### Data (same migration)
- `api_projects`: id, user_id, name, description, api_type, base_url, version, auth_type, status ('draft'|'ready'|'submitted'), created_at, updated_at
- `api_endpoints`: id, project_id, route, method, parameters jsonb, headers jsonb, request_body jsonb, response_body jsonb, validation jsonb, description
- `api_env_vars`: id, project_id, key, value (encrypted at rest is out of scope — plain text with RLS owner-only)
- RLS: owner + admin read; owner write.

### Server (`src/lib/api-projects.functions.ts`)
- CRUD for projects, endpoints, env vars.
- `testApiEndpoint({ projectId, endpointId, overrides })` — server-side fetch to the configured base URL, returns status/time/body. Timeouts + size limits.
- `generateApiDocs({ projectId })` — builds Markdown / OpenAPI-ish JSON from stored endpoints (no external calls needed; pure transform).
- `generateProjectScaffold({ projectId })` — returns a zip-friendly file map (Node/Express template) as JSON the client can download.

### UI — new service
- Add a `services` row for "API Development Platform" (slug `api-dev`) via migration seed.
- `src/routes/_authenticated/services.api-dev.new.tsx` — wizard (type → project meta → endpoints → auth → test → docs → deploy prep), matches web-dev.new visual style with auto-advance on straightforward picks.
- `src/routes/_authenticated/services.api-dev.$projectId.tsx` — workspace: left project explorer + endpoint list, middle request/response builder, right documentation + testing console tabs. Spikes Bot pane in a collapsible side panel — reuses existing chat transport with a specialized system prompt (`/api/api-spikes` route or a mode flag on `/api/chat`).

### Spikes Bot API mode
- Extend `/api/chat` to accept `mode: 'api-dev'` with a system prompt tuned for API design help; the workspace passes the current project context (endpoints, auth) as an initial system message.

### Admin
- New tab in `admin.tsx`: **API Projects** → `admin.api-projects.tsx` lists all projects with owner, status, endpoint count; detail view shows endpoints and lets admin post a comment (`api_project_comments` table).

---

## Design

Reuse `glass-card`, `neon-text`, `glow-purple`, existing button/input variants. All new inputs get the visible border from the recent styles.css update. Auto-advance UX for the API wizard mirrors the web-dev flow.

---

## Constraints honoured

- AI never fabricates: system prompt says "If the answer isn't in the provided business info, say so and offer to connect an admin."
- Admin message flips `admin_active`; AI stops for that thread until admin toggles it back on.
- API platform clearly labels "Generate scaffold" vs. "Deploy" — scaffold produces downloadable files; actual deployment is out-of-scope guidance only.

---

## Delivery order in this turn

1. Migration (all new tables + column additions + grants + policies + seed service).
2. Server functions (ai-support + api-projects) and `/api/chat` mode.
3. Visitor `support.tsx` AI trigger + labels.
4. Admin: `admin.support.tsx` per-thread toggle + `admin.ai-settings.tsx` + `admin.api-projects.tsx` + tabs in `admin.tsx`.
5. Service wizard + workspace pages.
6. Verify build.

This is a large single turn; if any sub-area needs deeper polish (e.g. richer wizard, OpenAPI export, encrypted env vars) I'll flag it at the end for a follow-up.