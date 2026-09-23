# Roadmap

## Media Downloader (current)
- [ ] Fix: downloader settings readable by anyone (restrict to admins, public fields via server)
- [ ] Atomic rate-limit counter in the database
- [ ] Server functions: analyze, create job, poll/sync, cancel, retry, download link, history, delete
- [ ] Worker heartbeat endpoint (signed with the worker secret)
- [ ] Pages: Downloader (paste, analyze, media view, formats, download), History, Account
- [ ] Navigation: Home, Downloader, History, Account (+ More menu), admin-only Admin
- [ ] Admin: downloader dashboard (analytics, jobs, platforms, rate limits, settings, audit logs)
- [ ] Admin: security & system diagnostics page (run checks, fix failures)
- [ ] Worker service (yt-dlp + FFmpeg) source + Dockerfile, tested locally end to end
- [ ] README.md, ARCHITECTURE.md, DEPLOYMENT.md
- [ ] Deploy worker to a host + save WORKER_API_URL / WORKER_API_SECRET (blocked: needs user's hosting account)

## Earlier unfinished
- [ ] Admin cloud panel, Cloud link in menu, admin visitor-chat alert, AI Assistant settings polish
