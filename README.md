# SR Action Hub

**Every client request. Logged. Tracked. Completed.**

The operational heart of SR Accounting — every client interaction that requires work is captured as an Action and tracked until completion. This replaces phone slips, sticky notes, Outlook task lists, and memory.

This is **Phase 1 – Core Foundation** of the full master spec: authentication and roles, clients, Actions (create/assign/status workflow/snooze/soft-delete), the dashboard with KPI cards and staff tabs, and search/filters. Comments, attachments, checklists, templates, automatic client emails, reports, notifications, and all external integrations (Outlook, Teams, OneDrive, WhatsApp, SARS, AI) are real Phase 2+ work, not built yet.

## Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: Prisma ORM, currently pointed at **Postgres** for fast local development. The schema deliberately avoids Postgres-only features, so moving to **SQL Server** (as originally specified) is a config change, not a rewrite — see "Moving to SQL Server" below.
- **Auth**: Local email/password (bcrypt + JWT in an httpOnly cookie). Microsoft Login is Phase 2+ (it requires registering an app in your Microsoft 365 tenant, which only you can do).

## Running it locally

**Backend**

```bash
cd backend
cp .env.example .env   # adjust DATABASE_URL if needed
npm install
npm run prisma:migrate  # creates tables
npm run prisma:seed     # seeds users, request types, a sample client
npm run dev              # http://localhost:4000
```

Seeded users (all with password `Welcome123!` — change these before real use):

| Name | Email | Role |
|---|---|---|
| Stephan | stephan@sraccounting.local | Staff |
| Chanel | chanel@sraccounting.local | Administrator |
| Sunanne | sunanne@sraccounting.local | Staff |
| Daniella | daniella@sraccounting.local | Staff |

**Frontend**

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173, proxies /api to the backend
```

You need Postgres running locally (`sudo service postgresql start` on Debian/Ubuntu, or use Docker) with a database and user matching your `.env`.

## What's built (Phase 1)

- Login (local email/password), role-aware session (Administrator vs Staff)
- Clients + Contacts (create inline while creating an Action, or search existing)
- Request Types managed list, seeded with the spec's examples; selecting "Other" lets an Administrator save it as a new permanent type
- Actions: full required-field creation form, auto-generated ticket numbers (`ACT-2026-000001`, never reused, sequential per year), automatic due-date calculation from the chosen turnaround
- Status workflow (New → Allocated → In Progress → Waiting for Client/SARS/Bank/Third Party → Snoozed → Completed/Cancelled), with every change recorded to a visible timeline
- Snooze with a reason, staying visible on the board (not hidden) with a "Snoozed until X" banner
- Soft delete + restore, Administrator-only (Staff cannot permanently delete)
- Dashboard: the six KPI cards from the spec, staff tabs (ALL/STEPHAN/CHANEL/SUNANNE/DANIELLA), Stephan's items always shown with a red accent
- Search (client/contact/phone/reference/description) and the filter chips from the spec (Mine/Today/Urgent/Overdue/Waiting/Snoozed/Unallocated/Completed)

## What's deliberately not built yet

Per the spec's own phasing:

- **Phase 2 – Productivity**: comments, attachments, checklists, request templates, automatic client acknowledgement/completion emails, reports, in-app/desktop/email notifications
- **Phase 3 – Integrations**: Outlook, Microsoft 365/Teams SSO, OneDrive, WhatsApp Business, calendar
- **Phase 4 – Intelligence**: AI prioritisation/summaries/allocation, predictive reporting

## Moving to SQL Server

1. In `backend/prisma/schema.prisma`, change the datasource `provider` from `"postgresql"` to `"sqlserver"`.
2. Point `DATABASE_URL` in `.env` at your real SQL Server / Azure SQL instance (format: `sqlserver://host:1433;database=sr_action_hub;user=...;password=...;encrypt=true`).
3. Run `npm run prisma:migrate` to create the schema there, then `npm run prisma:seed`.

## Deploying it live

This needs real hosting for both the backend (a Node process) and a database — it cannot be a static site like a GitHub Pages deploy. Reasonable options: Azure App Service + Azure SQL (matches the original spec exactly), or Render/Railway + their managed Postgres for something faster to stand up. Happy to help wire up whichever you pick once you're ready to go live — that's a separate step from what's in this repo today.
