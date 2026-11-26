# Roadmap

## Spikes Bot WhatsApp automation (new briefs)
- [x] Audit the uploaded requirements and keep unsupported workflows explicitly unavailable
- [x] Build a separately deployable linked-device engine with encrypted session storage and authenticated controls
- [x] Implement a tested, limited set of working WhatsApp commands and truthful readiness reporting
- [x] Connect owner-only dashboard controls, pairing flow, command states, and activity to the live engine API
- [ ] Deploy the engine, configure its shared control token and encryption key, then verify pairing and live WhatsApp messages (blocked: owner hosting and WhatsApp account access)
- [x] Add a subtle animated 3D circuit background with reduced-motion and low-power handling
- [ ] Configure the engine URL and generated shared control token in the app after deployment

## Immersive UI redesign & responsive optimization (current)
- [x] Fix PublicHeader build errors (hash link typing)
- [x] Page theme system (page-theme.ts + theme classes in styles.css)
- [x] PageAmbience component (per-page backgrounds, reduced-motion, mobile-aware, pauses when hidden)
- [x] Wire themes into authenticated layout; remove global CyberBackground from layout
- [x] Fluid typography utilities + safe-area / svh / touch-target CSS base
- [ ] Portal theme on auth, reset-password, pay pages
- [ ] Mobile header polish (Navbar + PublicHeader): safe areas, 44px targets, compact layout
- [ ] Mobile admin: responsive tables (scroll wrappers / card fallbacks), collapsible admin nav
- [ ] Downloader page mobile pass (single column results, tappable format cards)
- [ ] Results/history/account visual identity pass (studio/command themes already wired; refine components)
- [ ] Diagnostics section: console status colors (ok/warn/crit tokens)
- [ ] Responsive QA sweep at 320–1920px widths (overflow, clipping, touch targets) via Playwright
- [ ] Fix any issues found, re-run QA

## Media Downloader (current)
- [ ] Fix: downloader settings readable by anyone (restrict to admins, public fields via server)
- [ ] Atomic rate-limit counter in the database
- [ ] Worker heartbeat endpoint (signed with the worker secret)
- [ ] Admin: downloader settings security finding — mark fixed via manage_security_finding
- [ ] README.md, ARCHITECTURE.md, DEPLOYMENT.md
- [ ] Deploy worker to a host + save WORKER_API_URL / WORKER_API_SECRET (blocked: needs user's hosting account)

## Earlier unfinished
- [ ] AI Assistant settings polish
