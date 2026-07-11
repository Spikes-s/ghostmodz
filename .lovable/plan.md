## What ships this turn (in order)

### 1. Database (single migration)
- `website_requests` — client submissions (website_type, booking_type, details JSONB, features JSONB, status, admin_notes, estimated_price, estimated_days, quoted_at, quote_token, deposit_percent)
- `notifications` — per-user bell (user_id, kind, title, body, link, read_at)
- `support_threads` + `support_messages` — realtime client↔admin chat
- `payments` — placeholder ledger tied to a website_request (amount, currency, status, marked_paid_by)
- Extend `site_settings` with `whatsapp_bot_url`, `cloud_solutions_url`, `hero_title`, `hero_subtitle`
- RLS: users see their own; admins see all. Realtime enabled on `notifications`, `support_messages`, `website_requests`.

### 2. Homepage fixes (`src/routes/_authenticated/index.tsx`)
- "Explore Services" smooth-scrolls to `#services` and briefly pulses the section
- New "Live Terminal" hero button → routes to the terminal page (uses existing Terminal component in its own route `/terminal`)
- Remove the "Browse all services" CTA below the grid
- Each service card becomes a `<button>` that routes based on the service's `slug`/`link_type`

### 3. Service card router (`src/components/ghost/ServiceCard.tsx`)
Slug-based mapping to workflow:
- `custom-web-development` → `/services/web-dev/new` (5-step questionnaire)
- `whatsapp-bot` → external redirect from `site_settings.whatsapp_bot_url`
- `telegram-bot` / `ai-automation` → `/support` (live chat)
- `ui-ux` / `software-dev` / `hosting-api` → generic questionnaire route (light stub form, submits to website_requests with a `service_kind` marker)
- `campus` → `/services/campus/apply`
- `cloud-solutions` → external redirect from `site_settings.cloud_solutions_url`
- Any unmatched slug falls back to existing `/services/$slug` detail page

### 4. Web Dev questionnaire (`/services/web-dev/new`)
5-step wizard (React state, no url params) — Type → General → Features → Summary → Submit. Zod-validated. Submits via `submitWebsiteRequest` server fn. Toast + redirect to `/account/requests/$id`.

### 5. Client dashboard (`/account/requests` + `/account/requests/$id`)
Lists user's own requests, status pills, opens detail. Detail shows the quote when present + "Proceed to payment" button linking to `/pay/$token`.

### 6. Admin Website Requests (`/admin/requests-website`)
Table (client, type, features count, status, date). Row → drawer: notes, estimated price (KES), estimated days, deposit %. Actions: `Send Quote`, `Approve`, `Reject`, `Request info`. `Send Quote` mints `quote_token`, inserts notification, and sends the `website-quote` app email with a link to `/pay/$token`.

### 7. Payment page (`/pay/$token`)
Public token-gated page (no login required to view amount). Shows project summary, price, deposit, "Mark as paid (bank transfer / M-Pesa manual)" client button that inserts a `payments` row with `status='pending_confirmation'`. Admin confirms in the admin drawer — notifies client on confirm.

### 8. Notifications
- `notifications` table + realtime subscription in a new `<NotificationBell />` component in the navbar
- Server fns: `listNotifications`, `markRead`, `markAllRead`
- Emitted on: new request submitted (→ all admins), quote sent (→ client), payment recorded (→ admins), payment confirmed (→ client), new support message (→ counterpart)

### 9. Live chat (`/support` + `/admin/support`)
- Client: single thread per user, message list, sticky composer, realtime via `supabase.channel`
- Admin: thread list on the left, active thread pane on the right
- Both use existing markdown renderer for messages

### 10. Emails (Lovable Emails)
- Runs `email_domain--check_email_domain_status` first; if no domain, I stop and present the setup dialog to you
- If domain exists: scaffold infra + transactional templates, add 3 templates: `website-request-received` (client), `admin-new-request` (admins), `website-quote-sent` (client with pay link)

### 11. Settings CMS extensions (`/admin/settings`)
Just the fields the routers need this turn: `whatsapp_bot_url`, `cloud_solutions_url`, `hero_title`, `hero_subtitle`. Full General/Contact/Social/Branding rebuild deferred to a follow-up turn.

## Technical notes
- All new server functions live in `src/lib/workflow.functions.ts` (guarded by `requireSupabaseAuth`; admin-scoped ones re-check `has_role`)
- `quote_token` is a random 32-char string; the pay page fetches by token via a server fn that does NOT require auth (so links work from email)
- All new tables get GRANTs + RLS + realtime publication in the same migration
- Emails use per-recipient `idempotencyKey` derived from `request.id + template`
- Terminal page: adds `src/routes/_authenticated/terminal.tsx` wrapping the existing `<Terminal />` component

## Deferred (explicit)
- UI/UX / Software / Hosting deep questionnaires (they get one generic form this turn)
- Full Settings CMS rebuild (General/Branding/Social)
- Real payment processor (placeholder only, per your answer)
- Campus applications page (basic form, no dedicated schema — reuses website_requests with `service_kind='campus'`)

Say "go" and I start executing top-to-bottom, or tell me which chunks to drop/reorder.