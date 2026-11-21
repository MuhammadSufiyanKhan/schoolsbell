# SchoolsBell

School management system built with **Next.js 16 (App Router)**, TypeScript, Tailwind CSS v4, Drizzle ORM and PostgreSQL, with AI features via the Vercel AI SDK.

## Quick start

```bash
npm install
npm run db:seed     # applies migrations + loads demo data (embedded Postgres in .data/)
npm run dev         # http://localhost:3000
```

Demo accounts (password `password123`): `admin@school.test`, `teacher@school.test`, `parent@school.test`, `student@school.test`.

## What's included (MVP)

| Module | Admin | Teacher | Parent / Student |
|---|---|---|---|
| Dashboard with early-warning list | school-wide | own classes | own children |
| Students (search, detail, enrol) | ✅ | view | – |
| Classes & subjects | ✅ | own | – |
| Attendance register (upsert, audit-logged) | ✅ | own classes | read-only history |
| Gradebook (weighted assessments) | ✅ | own subjects | read-only |
| Fees & invoices | ✅ mark paid | – | read-only |
| Announcements (audience-targeted) | ✅ | ✅ | read |
| AI assistant | ✅ | ✅ | – |

**AI assistant:** lesson plans, quizzes, report-card comments, parent messages. Output is always a draft. Prompts never contain a student's surname, roll number or ID, only the first name and aggregate numbers.

## Configuration

Copy `.env.example` to `.env.local`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres (Neon etc.). Empty = embedded PGlite in `.data/` for local dev |
| `SESSION_SECRET` | **Required in production** (the app refuses to start without it) |
| `GROQ_API_KEY` | **Groq** key ([get one](https://console.groq.com/keys)). All AI features run on Groq; without it the AI pages say it isn't set up |
| `GROQ_MODEL` | Optional pin. Unset = tries `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `moonshotai/kimi-k2-instruct-0905` in turn and remembers the one that works |
| `AI_REASONING` | `none`/`minimal`/`low`/`medium`/`high` (default `low`). Higher thinks longer before answering |
| `AI_TIMEOUT_SECONDS`, `AI_FIRST_CHUNK_SECONDS`, `AI_CHUNK_GAP_SECONDS` | Hard time limits (defaults 120 / 60 / 30): a stuck model gives a clear message instead of hanging |

### Deploying to Vercel

1. Add a Postgres database from the Vercel Marketplace (e.g. Neon); this sets `DATABASE_URL`.
2. Set `SESSION_SECRET` (`openssl rand -base64 48`).
3. Run migrations and seed once against the production DB: `DATABASE_URL=... npm run db:seed` (skip the seed's demo data for a real school by creating your own admin).
4. Deploy.

## Architecture notes

- **Multi-tenant ready:** tenant-owned tables carry `school_id`; queries are scoped through `src/lib/scope.ts`.
- **Authorization:** every server action calls `requireUser([...roles])` and re-checks resource access (e.g. teachers can only save grades for subjects they teach). `src/proxy.ts` is only an optimistic redirect.
- **Audit log:** attendance, grades, fees and enrolment changes are recorded in `audit_log`.
- **Schema changes:** edit `src/db/schema.ts`, run `npm run db:generate`, commit the new SQL in `drizzle/`, then `npm run db:migrate`.

## Roadmap

Online payments (Stripe/local gateway), timetable builder, assignments & LMS, SMS/WhatsApp notifications, parent mobile app (PWA first), RAG study tutor, natural-language analytics, admin user management UI, CSV import.
