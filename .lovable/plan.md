## SHILLINGITRACK — Build Plan

This is a very large scope (5 phases, ~15 feature areas, ~25 database tables). To ship production-quality code rather than stubs, I'll break it into sequential milestones you approve one at a time. Each milestone is independently usable.

### Upfront decisions I need from you

1. **Equipment scope** — you asked me to ask: Business-only, or Business + Personal? I'll default to Business unless you say otherwise.
2. **Recurring job scheduler** — flagging now: on this stack (TanStack Start on Cloudflare Workers + Supabase), the honest options for a daily job are (a) `pg_cron` inside Supabase calling a Postgres function that generates due transactions, or (b) an external cron hitting a public `/api/public/*` endpoint. I'll use **pg_cron** — it's fully inside Supabase, no external dependency. If pg_cron isn't enabled on your project I'll surface that clearly instead of faking it.
3. **PDF/zip libs** — I'll add `jspdf`, `jszip`, `otpauth`/native WebCrypto where needed. No `xlsx`.
4. **Passkeys** — Supabase Auth doesn't natively support WebAuthn passkeys today; it supports TOTP MFA. I'll ship **email/password + TOTP MFA** and label the plan honestly. True passkey (WebAuthn) login requires a custom auth flow that's out of scope for a from-scratch build of this size. Confirm you're OK with TOTP-only for the "biometric" story, or I can add device-level WebAuthn as a *second factor* wrapper (still not a passwordless passkey login).

### Milestones

**M1 — Foundations (Phase 1)**
Enable Lovable Cloud. Design system in `styles.css` (Ink Black canvas, gold accent, forest/brick, tabular grotesk + humanist sans via Google Fonts `<link>`). Auth (email+password, session list, auto-lock, security_log). Schema: profiles, accounts, categories, transactions, tags, category_learnings, security_log — all with RLS + GRANTs. Workspace toggle in header. Quick Capture parser (deterministic: leading-number + synonym/learning match + inline clarify). Dashboard (hero balance, 30d sparkline, 3-stat row, top categories, recent activity, savings ring, MoM bars). Sidebar/bottom nav (5 items). Soft-delete + password re-confirm modal. Private Storage bucket for receipts w/ signed URLs.

**M2 — Categories, Budgets, Goals, Debts, Search (Phase 2)**
Category CRUD + merge/archive + reassign-on-delete modal. Budgets table + progress bars + 75/90/100% banner. Goals + goal_contributions + progress ring + forecast + recurring contributions. Debts + debt_payments + two-list view w/ overdue flag. Global search (Postgres ilike across 4 entities, grouped results, ⌘K).

**M3 — Reports (Phase 3)**
Reports screen: sliding pill date range, workspace/category filters, hero stats + vs-prior-period delta, Recharts (trend line, donut, MoM bars, waterfall, calendar heatmap for Month/Year only). CSV + PDF export (jspdf).

**M4 — Business layer (Phase 4)**
clients, projects, invoices, invoice_items, invoice_payments. Add project_id/client_id to transactions. Clients list/detail w/ lifetime revenue. Projects pipeline (Quoted→Paid) w/ actual rollups. Invoice creation + partial payments that auto-create business income transactions. Business dashboard variant (Active Clients, Pipeline, Outstanding Invoices).

**M5 — Equipment, Security Hardening, Recurring (Phase 5)**
equipment + equipment_maintenance (straight-line depreciation, business-scope by default). Asset Overview card. Supabase TOTP MFA + recovery codes + regenerate. Extended session list + revoke. Audit all destructive actions → password re-confirm. Backup/export: JSON+CSV zip via jszip, WebCrypto AES-GCM encryption w/ passphrase, restore w/ preview + re-confirm. Extended security_log events. recurring_rules table + pg_cron daily job + Upcoming widget + pause/skip.

### Working style

I'll ship M1 in this next turn (it's the foundation everything else builds on), then check in with you before starting M2. Each subsequent milestone will be one focused turn with migration + code + verification. This keeps each turn reviewable and avoids a 20k-line dump that's impossible to audit.

### Honest limitations I'll flag as I hit them

- No true WebAuthn passkey login (Supabase Auth limit) — TOTP MFA instead.
- Daily recurring job depends on pg_cron being enabled on your Supabase project; I'll verify at M5.
- No real bank/M-Pesa connection — M-Pesa is just a default account label, per your spec.
- No Excel export.
- No Google Drive backup sync.

**Please confirm:**
- (a) Equipment: Business-only OK?
- (b) TOTP-only for 2FA OK (no true passkeys)?
- (c) Proceed milestone-by-milestone starting with M1?
