# Myriad Ledger

Build SHILLINGITRACK — a personal and business financial operating system.




It is NOT a banking app: it never moves real money and never connects to banks. Every number displayed is a live calculation over transactions the user records themselves.




Core loop: the user types a plain-language entry ("50 tomatoes", "10000 wedding photography") and the system categorizes it intelligently, files it under Personal or Business, and instantly updates the dashboard.




Design north star: Apple, Stripe, Linear, Notion — quiet, confident, minimal. Never a generic AI-dashboard template. Never gradients, glassmorphism, neon, or decorative animation.




DESIGN SYSTEM — use exactly this, do not substitute:

- Ink Black #14161B — primary dark canvas

- Card surface #1C1F26

- Signature Gold #C9A24B — reserved only for meaning: positive amounts, active states, progress, confirmations. Never decorative.

- Ivory text #F3EEE2 (primary), muted #8B8D97 (secondary)

- Forest green #5FA98A (income/positive), muted brick red #C97B6C (expense/negative)

- Typography: a confident grotesk for numbers with tabular figures so amounts always align; a warmer humanist sans for labels

- Corners: 12px cards, 8–10px controls. No drop shadows. Hairline 0.5–1px borders only.

- Motion: purposeful only — a number ticking to its new value, a card sliding into a list. Nothing decorative, nothing bouncy.




TECH STACK — use exactly this:

- React + TypeScript + Tailwind + shadcn/ui

- Supabase: Postgres database, Auth, Row-Level Security, Storage (for receipt/attachment files)

- TanStack Query for data fetching/caching

- Recharts for charts

- Zod for validation

- React Router




AUTHENTICATION

Use Supabase Auth: email + password, plus WebAuthn-based passkey login where the browser supports it. On supporting devices this does trigger the device's own fingerprint/face prompt, so it's fine to label it "biometric unlock" in the UI. Add session management (view/revoke active sessions), auto-lock after configurable inactivity (5/10/15/30/60 min) requiring re-auth, and a security event log (login, password change, backup created/restored) stored in its own table.




DATA MODEL — build these tables first, with Row-Level Security scoping every row to the owning user via auth.uid():

- profiles

- accounts (M-Pesa as the default account, plus Cash/Bank/SACCO/custom accounts the user can add)

- categories (with parent_id for subcategories, icon, color, workspace scope)

- transactions (amount, type: income/expense/transfer, category_id, account_id, workspace: personal/business, description, date, tags array, notes, receipt_url, created_at)

- tags

- category_learnings (term, category_id — for the quick-capture matcher below)

- security_log (event_type, timestamp, device_info)




WORKSPACE TOGGLE

Personal and Business are a single toggle switch in the header, never separate apps. Every query filters by the active workspace. Support a "Combined" view for reporting only — a transaction is always explicitly Personal or Business at the moment it's created, never ambiguous.




QUICK CAPTURE (the signature feature — build this carefully)

A persistent input, reachable from every screen, that parses free text like "20 transport" or "50 tomatoes" into amount + category. Parse the leading number as the amount, then match the remaining text against the user's existing category names and a seeded synonym table (e.g. "tomatoes/onions/veggies" → Food > Groceries) using deterministic string matching — not a claimed ML model. When a typed term doesn't match anything, ask a single inline clarification question and save the user's choice to category_learnings so the same term resolves instantly next time. Show a live preview chip that resolves as the user types, and confirm the entry on pressing enter.




DASHBOARD

Hero balance (sum of all transactions in the active workspace) in large tabular numerals, with a 30-day sparkline beneath it. A three-stat row: money in / money out / net for the selected period. Below that, a card grid: top categories (horizontal bar list), recent activity (last 6–8 transactions), a savings goal progress ring, and a this-month-vs-last-month bar comparison. Every value recomputes live from Supabase — no manual refresh button.




NAVIGATION

Permanent sidebar on desktop, collapsible sidebar on tablet, bottom nav bar on mobile with exactly five items: Dashboard, Transactions, Reports, Search, Settings. Everything else lives under Settings — do not try to cram more items into the bottom bar.




SECURITY & DATA HANDLING

All tables use Row-Level Security scoped to auth.uid() — no data ever visible across users. Require password re-confirmation via a modal (not just a click) before permanently deleting transactions. Deleted transactions move to a soft-delete state (a deleted_at column) recoverable for 30 days — never hard-delete immediately. Receipt attachments go to a private Supabase Storage bucket with signed URLs, never public.




Build this as production-quality code with proper error handling and loading states — no placeholder data, no fake charts, no stub screens. If something in this spec can't be fully implemented with the current stack, tell me explicitly rather than faking it.


Now build Phase 2 of SHILLINGITRACK: Categories, Budgets, Goals, Debts, and Search.




Keep using the exact same design system already established: Ink Black #14161B canvas, card surface #1C1F26, Signature Gold #C9A24B reserved only for meaning (positive amounts, progress, active states — never decorative), ivory text #F3EEE2, muted text #8B8D97, forest green #5FA98A for positive/income, muted brick red #C97B6C for negative/expense. Same tabular numerals for all amounts. Same hairline borders, 12px card corners, no drop shadows, no decorative animation.




CATEGORY MANAGEMENT

Build a full category management screen under Settings. Support creating, renaming, merging, and archiving categories, including nested subcategories (using the existing parent_id column). When a user deletes a category that has transactions attached, do not silently orphan those transactions — show a modal forcing a choice: "Reassign these transactions to another category" or "Leave them uncategorized," and require an explicit selection before the delete proceeds. Categories keep their icon and color fields editable from this screen.




BUDGETS

New table: budgets (category_id, workspace, amount, period_type: weekly/monthly/custom, start_date, end_date, created_at). Users can set a budget per category for a chosen period. Show budget progress as a horizontal bar on the Budgets screen and, where relevant, inline on the category itself: a slim progress bar under the category name showing amount spent vs budget for the current period. Trigger an in-app banner notification (not email, not push) when a budget crosses 75%, 90%, and 100% of its limit. Keep the copy factual and calm — never shame the user, e.g. "Food budget: 92% used, KES 460 remaining" not "You're about to overspend!"




GOALS

New table: goals (name, description, target_amount, current_amount, deadline, workspace, category, color, icon, status, created_at) and goal_contributions (goal_id, amount, date, notes, account_id). Goal screen shows each goal as a card with a circular progress ring (same ring pattern used for the dashboard savings widget), current vs target amount in tabular numerals, and a forecasted completion date computed from the average contribution rate over the goal's history. Support manual one-off contributions and scheduled recurring contributions (weekly/monthly, stored as a simple recurrence rule). Allow pausing, archiving, and duplicating a goal.




DEBTS

New table: debts (person_or_institution, direction: owed_to_me/i_owe, original_amount, current_balance, interest_rate, due_date, workspace, status, notes, created_at) and debt_payments (debt_id, amount, date, remaining_balance_after, notes). Build two clearly separated lists on the Debts screen — "Money owed to me" and "Money I owe" — each sorted by due date by default, with overdue items visually flagged using the muted brick red, not a jarring alert color. Each debt opens to a detail view showing its full payment history and a running balance.




GLOBAL SEARCH

Build a global search accessible from the persistent search icon in the header (already present in the nav) and from a keyboard shortcut. Query transactions, categories, goals, and debts using Postgres ilike or full-text search across description, category name, tags, notes, and amount. Group results by type (Transactions / Goals / Debts / Categories) in the results dropdown, each group showing at most 5 results with a "see all" link. Results should return in well under a second for realistic personal-scale data — thousands of rows, not millions, at this stage.




Build this as production-quality code with proper error handling and loading states — no placeholder data, no fake charts, no stub screens. If something in this spec can't be fully implemented with the current stack, tell me explicitly rather than faking it.

 
Now build Phase 3 of SHILLINGITRACK: Reports & Analytics.




Keep using the exact same design system already established: Ink Black #14161B canvas, card surface #1C1F26, Signature Gold #C9A24B reserved only for meaning (positive amounts, progress, active states — never decorative), ivory text #F3EEE2, muted text #8B8D97, forest green #5FA98A for positive/income, muted brick red #C97B6C for negative/expense. Same tabular numerals, hairline borders, 12px card corners, no drop shadows, no decorative animation. Use Recharts for every chart on this page.




REPORT CENTER

Build a dedicated Reports screen reached from the sidebar/bottom nav. At the top, a horizontal pill-style date range selector: Day / Week / Month / Quarter / Year / Custom. Selecting a pill should smoothly slide the active-state highlight rather than hard-cutting between options. Selecting "Custom" opens a compact dual-calendar range picker. This selector drives every chart and number on the rest of the page — changing it should refetch and re-render everything below without a page reload.




Also add filters for workspace (Personal / Business / Combined) and category, both as simple dropdowns next to the date selector.




HERO SUMMARY

Directly under the filters, a three-stat row identical in style to the dashboard: Money In, Money Out, Net — for the selected period, with tabular numerals and the same green/red/gold color logic as elsewhere in the app.




CHARTS (all using Recharts, all reading from the transactions table filtered by the active date range/workspace/category)

1. Income vs expense trend line — two thin lines (green for income, red for expense) across the selected period, with a light gold-tinted area fill under the gap when income exceeds expense.

2. Category breakdown donut — top 6 categories as segments, remainder grouped into "Other," center of the donut showing the total spend in large tabular numerals.

3. Month-over-month bar comparison — this period's total next to the previous period's total, with a percentage delta label (e.g. "+18%") next to the bars, colored green if favorable and muted red if not.

4. Cash flow waterfall — for the selected period, a sequence of floating bars showing how the starting balance moves through each major category to the ending balance.

5. Spending heat map — a calendar-grid view (GitHub-contribution-style, using the gold ramp instead of green) where darker cells indicate heavier spending days. Only render this for Month or Year ranges — hide it for Day/Week selections where it wouldn't be meaningful.




COMPARISON LOGIC

Add a small comparison line under the hero summary: "vs [previous equivalent period]" with a computed percentage change. This should compare the selected range against the immediately prior range of equal length — e.g. this month vs last month, this quarter vs last quarter, or for a custom range, the same-length period immediately before it.




EXPORT

Add an "Export" button on the Reports screen with two options: CSV (raw transaction rows for the current filtered view) and PDF (a clean printable summary of the hero stats and the category breakdown, using a library like jspdf). Do not add an Excel/.xlsx export in this phase unless you add the sheetjs library explicitly to support it.




CHART BEHAVIOR

Every chart should support hover tooltips showing exact values. Charts must remain legible and correctly laid out in both dark and light mode if the app supports a light mode toggle, and must reflow correctly on mobile widths rather than overflowing or getting clipped.




Build this as production-quality code with proper error handling and loading states — no placeholder data, no fake charts, no stub screens. If something in this spec can't be fully implemented with the current stack, tell me explicitly rather than faking it.


Now build Phase 4 of SHILLINGITRACK: the Business workspace — Clients, Projects, and Invoicing.




Keep using the exact same design system already established: Ink Black #14161B canvas, card surface #1C1F26, Signature Gold #C9A24B reserved only for meaning (positive amounts, progress, active states — never decorative), ivory text #F3EEE2, muted text #8B8D97, forest green #5FA98A for positive/income, muted brick red #C97B6C for negative/expense. Same tabular numerals, hairline borders, 12px card corners, no drop shadows, no decorative animation.




This phase reuses the existing transaction, category, and reporting engine from Phases 1–3 — it does not duplicate them. Business transactions already exist as rows in the transactions table with workspace = 'business'; this phase adds the client/project/invoice layer on top of that data, not a parallel system.




DATA MODEL — new tables, all with Row-Level Security scoped to auth.uid():

- clients (name, business_name, phone, email, location, status: lead/prospect/active/vip/inactive, notes, created_at)

- projects (name, client_id, category, description, venue, start_date, end_date, status: quoted/booked/in_progress/delivered/paid/cancelled, estimated_revenue, estimated_cost, notes, created_at)

- invoices (invoice_number, client_id, project_id, issue_date, due_date, subtotal, tax, total, amount_paid, status: unpaid/partial/paid/overdue/cancelled, notes, created_at)

- invoice_items (invoice_id, description, quantity, unit_price)

- invoice_payments (invoice_id, amount, date, payment_method, account_id, reference, notes)




Link transactions to projects and clients via nullable project_id and client_id columns on the existing transactions table — when a business transaction is created and a project is selected, tag it, so project revenue/expense rollups can be computed by summing linked transactions.




CLIENT MANAGEMENT

Build a Clients screen (list + detail view) reachable from the Business side of the workspace toggle. List view: searchable/filterable table of clients with status badge, and a lifetime revenue figure computed by summing all transactions and paid invoice amounts linked to that client. Detail view: client info at top, then tabs or sections for Projects, Invoices, and a simple activity timeline (transactions and invoice events involving this client, most recent first).




PROJECT MANAGEMENT

Build a Projects screen showing all projects as cards or rows grouped/filterable by status, in the pipeline order: Quoted → Booked → In Progress → Delivered → Paid. Each project card shows client name, category, dates, and a compact revenue/expense/profit summary (actual, computed from linked transactions — not the estimate). Project detail view shows the full financial breakdown (estimated vs actual revenue, estimated vs actual cost, profit margin), linked transactions, and linked invoices.




INVOICING

Build an Invoice creation flow: select client and optionally a project, add line items (description, quantity, unit price), auto-calculate subtotal/tax/total, set a due date, and save as a draft or send (status moves to "unpaid"). Build an invoice detail/print view that renders cleanly for PDF export (reuse the PDF export approach from Phase 3's reporting if a library is already in place, or add jspdf if not). Support recording partial payments against an invoice via invoice_payments — each payment recorded should update amount_paid and automatically flip the invoice status to "partial" or "paid" once amount_paid reaches the total. A recorded invoice payment should also create a corresponding income transaction in the transactions table (workspace = 'business', linked to the client and project) so it flows into the existing dashboard and reports without any separate calculation logic.




BUSINESS DASHBOARD

Build a Business-specific dashboard view shown when the workspace toggle is set to Business. Reuse the same dashboard card components from Phase 1 (hero balance, three-stat row, top categories, recent activity) but swap the vocabulary and add business-specific cards: Active Clients (short list with status), Job Pipeline (a simple stage-count breakdown: how many projects in each status), and Outstanding Invoices (unpaid/overdue invoices sorted by due date, with total outstanding amount).




WHAT NOT TO BUILD IN THIS PHASE

Do not build equipment/asset tracking, crew/payroll management, or quotation-to-invoice conversion workflows in this phase — those are real future features but belong in a separately scoped phase once this client/project/invoice core is solid.




Build this as production-quality code with proper error handling and loading states — no placeholder data, no fake charts, no stub screens. If something in this spec can't be fully implemented with the current stack, tell me explicitly rather than faking it.


Now build Phase 5 of SHILLINGITRACK: Equipment/Asset Tracking, Security Hardening, and Recurring Transactions.




Keep using the exact same design system already established: Ink Black #14161B canvas, card surface #1C1F26, Signature Gold #C9A24B reserved only for meaning (positive amounts, progress, active states — never decorative), ivory text #F3EEE2, muted text #8B8D97, forest green #5FA98A for positive/income, muted brick red #C97B6C for negative/expense. Same tabular numerals, hairline borders, 12px card corners, no drop shadows, no decorative animation.




============================

PART A — EQUIPMENT & ASSETS

============================




DATA MODEL — new tables, all with Row-Level Security scoped to auth.uid():

- equipment (name, category, subcategory, brand, model, serial_number, purchase_date, purchase_price, current_value, depreciation_method: straight_line/none, useful_life_years, condition: new/excellent/good/fair/poor, status: available/assigned/in_repair/retired, storage_location, workspace, assigned_project_id nullable, warranty_end_date, notes, photo_url, created_at)

- equipment_maintenance (equipment_id, date, type: repair/routine/inspection, cost, technician_or_provider, notes, created_at)




Keep depreciation simple and honest: straight-line only in this phase (current_value = purchase_price − (purchase_price / useful_life_years × years_elapsed), floored at 0). Do not attempt declining-balance or units-of-production methods yet — they add real complexity for marginal value at this stage.




EQUIPMENT SCREEN

Build an Equipment screen (list + detail) reachable under the Business side of the workspace, or from Settings if it should also cover personal gear — ask the user which, but default to Business since that matches the AV production use case. List view: searchable table/grid with status badges, current value column, and a filter by category and status. Detail view: full record with an editable form, an equipment_maintenance history list (most recent first, add-new inline), and — if assigned_project_id is set — a link back to that project.




EQUIPMENT ANALYTICS

Add a small "Asset Overview" card to the Business dashboard: total current asset value, total spent on maintenance this year, and count of equipment currently marked "in_repair." Compute these live from the equipment and equipment_maintenance tables — no cached or placeholder numbers.




Do not build barcode/QR scanning, inventory/consumables tracking (batteries, cables, etc.), or multi-method depreciation in this phase — flag them as future scope if asked.




============================

PART B — SECURITY HARDENING

============================




TWO-FACTOR AUTHENTICATION

Use Supabase Auth's built-in MFA support (TOTP) rather than building custom OTP logic. Build a Settings > Security screen where the user can: enroll a TOTP authenticator (showing a QR code and manual entry key), confirm enrollment with a test code, view enrollment status, and disable 2FA (requiring password re-confirmation via modal first, per the existing sensitive-action pattern). Generate a set of one-time recovery codes at enrollment, shown once, downloadable as a text file, with a "regenerate codes" option that also requires password re-confirmation.




TRUSTED DEVICES & SESSIONS

Extend the session management already built in Phase 1: list active sessions with device/browser info and last-active time, allow revoking an individual session or all sessions except the current one.




SENSITIVE ACTION CONFIRMATION

Audit every existing destructive or high-stakes action across the app — permanent delete, backup restore, full data export, password change, disabling 2FA — and ensure every one of them routes through the same password re-confirmation modal pattern already established. Do not leave any of these as a single unconfirmed click.




BACKUP & EXPORT

Build a Settings > Backup screen with:

1. "Export my data" — generates a single JSON file containing all of the user's data (transactions, categories, accounts, budgets, goals, debts, clients, projects, invoices, equipment) plus a CSV per major table, bundled as a zip download (use a library like jszip).

2. "Encrypted backup" — before download, encrypt the export client-side using the Web Crypto API (AES-GCM) with a passphrase the user enters on the spot (not stored anywhere), so the downloaded file is unreadable without that passphrase. Clearly warn the user that if they lose the passphrase, the backup cannot be recovered — there is no reset for it.

3. "Restore from backup" — accepts an encrypted or plain export file, prompts for the passphrase if encrypted, shows a preview summary (record counts per table) before committing, and requires password re-confirmation before overwriting any existing data.




Do not build automatic Google Drive sync in this phase — that requires a separate OAuth integration and deserves its own focused build step. Flag it as future scope if asked.




SECURITY LOG

Extend the security_log table from Phase 1 to also record: 2FA enabled/disabled, recovery codes regenerated, backup created, backup restored, data exported. Show this as a simple reverse-chronological list on the Security settings screen — timestamp, event, and device.




================================

PART C — RECURRING TRANSACTIONS & SUBSCRIPTIONS

================================




DATA MODEL

Add a recurring_rules table (workspace, type: income/expense, amount, category_id, account_id, frequency: daily/weekly/biweekly/monthly/quarterly/yearly, next_occurrence_date, end_date nullable, status: active/paused, description, created_at). Add a nullable recurring_rule_id column on the existing transactions table so generated transactions link back to the rule that created them.




BEHAVIOR

Each recurring rule automatically generates a transaction on its next_occurrence_date (a scheduled Supabase Edge Function or database trigger run daily is the right approach — check what's available and tell me if a daily cron isn't supported, rather than faking it). After generating, advance next_occurrence_date to the following period. Support pause/resume on a rule, and "skip next occurrence" without cancelling the whole rule.




UI

Build a Recurring/Subscriptions screen listing all active rules with next-due date, amount, and category, sortable by next due date. Add an "Upcoming" widget to the main dashboard showing the next 3–5 scheduled recurring items. When a recurring transaction is generated, it should behave exactly like a manually entered transaction everywhere else in the app — same reports, same dashboard totals, no special-casing.




Build this as production-quality code with proper error handling and loading states — no placeholder data, no fake charts, no stub screens. If something in this spec can't be fully implemented with the current stack — especially the scheduled daily job for recurring transactions — tell me explicitly rather than faking it.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://shillingiflow.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d09c75ab-fd34-4810-bb3f-e5d64354d144).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
