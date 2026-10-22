# Seba — Healthcare Booking & Pharmacy Platform

Working name "Seba" (সেবা). Change it in one place: `NEXT_PUBLIC_BRAND_NAME` / `src/config/brand.ts`.

Status: **Phase 5 done.** Database foundation (1), app shell and design system (2), login,
family members and listings (3), booking, waiting list and notifications (4), and now provider
dashboards (5): clinic/doctor dashboard, weekly schedule editor, leave / time change / extra
sitting with patient SMS, the sitting queue (arrived / done / absent), phone and walk-in
bookings, "running late", cancelling a sitting, clinic registration with licence upload and
adding doctors. New clinics and new doctor–clinic links stay hidden from patients until an
admin verifies them (admin dashboard: Phase 7). Pharmacy comes in Phase 6.

## Quick start

Requires Node 22+ and PostgreSQL 15+.

```bash
npm install
cp .env.example .env.local          # then set DATABASE_URL and SESSION_SECRET
npm run db:migrate                   # creates all tables + launch towns and specialities
npm run db:seed:demo                 # optional: 6 fictional "Demo" doctors, 5 facilities
npm run dev                          # http://localhost:3000 → redirects to /bn
```

Open `/bn/design-system` in development to see every component and state.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run check` | Lint + typecheck + unit tests |
| `npm run db:migrate` / `db:status` | Apply / list migrations (checksummed; an edited applied migration is refused) |
| `npm run test:db` | Booking and pharmacy rule tests + booking race test (**wipes data — throwaway DB only**) |
| `npm run db:seed:demo` | Load / refresh fictional demo providers (`-- --remove` deletes them). Refused in production |
| `npm run test:integration` | Login, OTP limits, family members and directory against a real database (`TEST_DATABASE_URL`) |
| `npm run job -- generate-sessions` | Create sittings 14 days ahead from weekly schedules (safe to re-run) |
| `npm run job -- send-reminders` | SMS reminders for tomorrow's bookings (each booking once) |
| `npm run test:e2e` | Browser smoke test: every screen in both languages on a phone-size screen, axe accessibility, redirects, language switch, health check (needs a running server, `BASE_URL`) |

## Folder structure

```
db/migrations/            SQL migrations (schema, booking + order functions, reference data)
db/seed/demo.sql          fictional demo providers (development and staging only)
db/tests/                 SQL rule tests and the booking race test
scripts/migrate.ts        migration runner
src/proxy.ts              adds the language prefix (/bn or /en) to every page URL
src/instrumentation.ts    validates configuration when the server boots
src/app/[lang]/           all screens, one folder per route
src/app/api/health        uptime + database check
src/app/api/files         private files via short-lived signed links only
src/server/auth           phone normalisation, OTP, sessions
src/server/patients.ts    your details and family members (ownership checked in every query)
src/server/directory.ts   doctor and facility search, profiles, availability
src/server/provider/      dashboard data, schedule changes, queue, staff bookings, clinic onboarding
src/app/[lang]/provider   provider screens and their server actions
src/components/ui         design system: buttons, cards, fields, badges, availability, states
src/components/layout     top bar, bottom navigation, language switch
src/i18n/                 bn.json, en.json, locale helpers (Hindi wired in, not switched on)
src/lib/env*.ts           environment validation
src/lib/db.ts             PostgreSQL pool, transactions, database error codes
src/lib/adapters/         SMS, payments, storage, maps — each with a labelled dev mode
tests/unit                Vitest unit tests
tests/integration         tests against a real database
tests/e2e                 Playwright: smoke test of every screen, flows for Phases 3, 4 and 5
```

## Logging in during development

SMS is in dev mode, so no text is sent. After tapping "Send code", the 6-digit code appears in
the server output as `[DEV OTP — NOT SENT] +91******5678 code: 123456`. Codes expire after
10 minutes; 5 wrong tries lock a code; one code per minute and 5 per hour per number.

The end-to-end flow test (`tests/e2e/phase3-flow.mjs`) reads the code from the server log the
same way: `BASE_URL=... SERVER_LOG=server.log node tests/e2e/phase3-flow.mjs`.

## Scheduling and booking rules

- **Sittings** come from weekly templates (days, hours, seats, optional 1st/3rd-week-of-month rule).
  Leave, holidays and cancellations suppress a sitting; a time change moves it; an extra sitting adds one.
  Applying leave to an existing sitting cancels its bookings and returns every patient for SMS.
- **Booking** is atomic in the database: a seat is taken with one locked update, serial numbers are never
  reused, and one account can hold at most 5 upcoming bookings.
- **Cancel / change date** is allowed until booking closes, 30 minutes before the sitting
  (`platform_settings.booking_cutoff_minutes`). Clinics can always cancel.
- **Waiting list**: when a seat frees up, the first person waiting gets an SMS; first to book gets it.

## Background jobs

Run nightly (`generate-sessions`) and each evening (`send-reminders`) — from a system cron with
`npm run job -- <name>`, or from a hosting platform's cron by calling
`POST /api/jobs/<name>` with `Authorization: Bearer $CRON_SECRET` (the endpoint is disabled
unless `CRON_SECRET` is set to 32+ characters).

## Provider dashboard

Anyone logged in can open **Profile → For clinics and doctors** (`/bn/provider`).
Access is checked per clinic and per doctor on every action, and every change is audit-logged.

| Role | Can do |
| --- | --- |
| Clinic staff | Today's queue, phone/walk-in bookings, running late, confirm schedule, leave/time change |
| Clinic admin | All of the above, edit weekly schedules, cancel sittings, add doctors |
| Doctor | Their own schedules, leave and queues at every clinic they work at |

- **Schedule changes** rebuild future sittings; sittings that already have bookings are kept and
  reported, never silently dropped. Saving also confirms the schedule (resets the "last updated" time).
- **Leave / cancel** cancels bookings and SMSes each patient; a time change SMSes the new time.
- **Phone / walk-in bookings** create the patient account by phone number (no OTP needed) and
  SMS the serial. Staff can book until the sitting ends; the patient 5-booking cap does not apply.
- **Registering a clinic** needs a licence number and a PDF/JPG/PNG of the licence (≤10 MB,
  checked by file contents). At most 3 registrations can wait at once per account.
- **Adding a doctor** needs their council registration number and certificate. The link stays
  inactive until verified, so nobody can attach a verified doctor to their clinic unchecked.

Demo provider logins (after `npm run db:seed:demo`; the code is in the server log):
`6000000201` staff at Demo Chamber · `6000000202` admin at Demo General Hospital ·
`6000000203` Dr. Demo Anwar Hossain.

## Demo data

Every demo provider is named "Demo …", has registration number `DEMO-…`, is flagged `is_demo`,
and shows a "Demo listing — not a real doctor" label. Never load it into a production database.

## Outside services and dev mode

Every service defaults to dev mode and the app shows a "Test mode" strip:

- **SMS** — messages are logged with the number masked; nothing is sent. Real provider: Phase 7 (needs DLT-registered sender ID and templates).
- **Payments** — simulated gateway, order IDs start with `test_`. Razorpay order creation and signature checks are implemented and unit-tested.
- **File storage** — local private folder, served only through signed links that expire in ≤15 minutes. S3-compatible storage: Phase 6.
- **Maps** — no API key: directions open Google Maps; OpenStreetMap as fallback.

**Production refuses to start with any dev adapter.** For a staging site that must never take
real users, set `ALLOW_DEV_ADAPTERS_IN_PRODUCTION=true`.

## Adding Hindi

1. Add `src/i18n/dictionaries/hi.json` with every key from `en.json` (the unit tests check parity).
2. Add `hi` to `activeLocales` in `src/i18n/config.ts` and a loader in `src/i18n/dictionaries.ts`.

## Conventions

- Money in paise (`bigint`), never floating point. Times as `timestamptz`, shown in Asia/Kolkata.
- No secrets in code. Prescriptions never get a public URL. `audit_logs` is append-only.
- Colour tokens are checked against WCAG AA by a unit test.

Not legal advice: policies and compliance need review by a lawyer before launch.
