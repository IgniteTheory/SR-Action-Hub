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
- Automatic client acknowledgement, completion, and quote emails, sent via Microsoft Graph as the `ticketing@sraccounting.co.za` shared mailbox — see "Email via Microsoft Graph" below

## What's deliberately not built yet

Per the spec's own phasing:

- **Phase 2 – Productivity**: comments *(a lightweight version — timestamped notes per Action — now exists)*, attachments, checklists, request templates, reports, in-app/desktop notifications
- **Phase 3 – Integrations**: creating/updating Actions from incoming email, Microsoft 365/Teams SSO, OneDrive, WhatsApp Business, calendar
- **Phase 4 – Intelligence**: AI prioritisation/summaries/allocation, predictive reporting

## Moving to SQL Server

1. In `backend/prisma/schema.prisma`, change the datasource `provider` from `"postgresql"` to `"sqlserver"`.
2. Point `DATABASE_URL` in `.env` at your real SQL Server / Azure SQL instance (format: `sqlserver://host:1433;database=sr_action_hub;user=...;password=...;encrypt=true`).
3. Run `npm run prisma:migrate` to create the schema there, then `npm run prisma:seed`.

## Email via Microsoft Graph

Outbound email (acknowledgement, completion, and quote emails) is sent through Microsoft Graph, as the fixed `ticketing@sraccounting.co.za` shared mailbox — see `backend/src/lib/graphMail.ts` for the token acquisition and Graph calls, and `backend/src/lib/email.ts` for the three email templates that use it. This replaced a previous direct-SMTP integration; if `email.ts`/`graphMail.ts` ever mention SMTP or `nodemailer` again in a future change, that's a regression, not a revert worth keeping.

**Authentication model:** certificate-based app-only client credentials (OAuth 2.0 client-credentials flow), never a client secret and never a delegated/user login. The Entra app registration, certificate, and Exchange Online RBAC-for-Applications scoping (limited to the one shared mailbox — no tenant-wide `Mail.Read`/`Mail.Send`) were provisioned and verified outside this repository; only non-secret identifiers live here.

**Required environment variables** (see `backend/.env.example`):

| Variable | Value |
|---|---|
| `MS_TENANT_ID` | Entra tenant ID |
| `MS_CLIENT_ID` | The `SR Action Hub - Mail Runtime` app registration's client ID |
| `MS_SHARED_MAILBOX` | `ticketing@sraccounting.co.za` |
| `MS_CERTIFICATE_THUMBPRINT` | The active certificate's SHA-1 thumbprint |
| `MS_CERTIFICATE_PRIVATE_KEY_PATH` | Filesystem path to the certificate's private key (PEM). **Never** the key content itself as an env var value. |
| `MAIL_FROM_NAME` | Optional, defaults to `SR Accounting` — only affects the sign-off line in the email body, not the actual mailbox identity |

If any of the five `MS_*` variables are unset, sending silently no-ops (the same resilience pattern the app has always used) and the failure is recorded on the ticket's own `...EmailError` field instead of breaking whatever request triggered it.

**Installing the private key in production:** the private key must never be pasted into a plain Render environment variable or committed anywhere. Use Render's **Secret Files** feature (Dashboard → your service → Environment → Secret Files) to mount the PEM at a fixed path, then point `MS_CERTIFICATE_PRIVATE_KEY_PATH` at that path. Whoever holds the key on their workstation today is responsible for transferring it through that channel directly — it should not pass through this repository, a chat tool, or ordinary email at any point.

**Certificate rotation:** before the current certificate's expiry, generate a new certificate, upload it to the Entra app registration alongside the existing one (Entra supports multiple concurrent certificate credentials on one app), update `MS_CERTIFICATE_THUMBPRINT` and the Secret File to the new key, verify a real send/read succeeds, then remove the old certificate from the app registration. Re-run the Exchange RBAC-for-Applications authorization tests (verify the intended mailbox is in scope and an unrelated mailbox is denied) after any certificate, scope, or tenant change.

**Reading mail:** `graphMail.ts` also exports `readInboxMessages()`, since the provisioned app registration is also granted `Mail.Read`. It is deliberately **not** wired into any ticket-creation logic yet — which incoming emails should become Actions, how senders should be matched to existing Clients/Contacts, and how such Actions should be assigned are still open product questions, not yet answered.

**Testing:** `npm test` (backend) runs `graphMail.test.ts` against mocked Graph responses — no real credentials are used or required. It does not, and cannot, verify the real Microsoft configuration; see `ACCEPTANCE_TESTS.md` from the integration handoff for the runtime verification steps that still require the real deployed environment.

## Deploying it live

This needs real hosting for both the backend (a Node process) and a database — it cannot be a static site like a GitHub Pages deploy. Reasonable options: Azure App Service + Azure SQL (matches the original spec exactly), or Render/Railway + their managed Postgres for something faster to stand up. Happy to help wire up whichever you pick once you're ready to go live — that's a separate step from what's in this repo today.
