# Kitty

Collect from the group before the bill arrives. See [SPEC.md](SPEC.md) and [the wireframes](Kitty-v1-wireframes.pdf).

| Folder | What | Built with |
| --- | --- | --- |
| `apps/mobile` | Organiser app | Expo (React Native), TypeScript |
| `apps/web` | Member pay page | Next.js, TypeScript |
| `packages/core` | Money rules, UPI links, message text. No I/O. | TypeScript, Vitest |
| `packages/db` | Database types generated from the schema | Supabase CLI |
| `supabase` | Schema, row level security, seed data, database tests | Supabase (Postgres) |

## Setup

You need Node 22 and Docker Desktop (running). Everything else installs with the project.

```bash
npm install
npm run db:start      # local Supabase in Docker. First run downloads images.
npm run db:status     # shows local URLs and keys
```

Local Supabase uses ports 55321 to 55329, so it can run next to other Supabase projects.

- Studio (browse the database): http://127.0.0.1:55323
- Mailpit (login code emails): http://127.0.0.1:55324
- Sample organiser: `rohan@kitty.local`, with four kitties from the wireframes

## Logging in to the organiser app locally

1. `npm run dev:mobile`, then press `w` for the browser or scan the QR code with Expo Go.
2. Log in with `rohan@kitty.local`, or sign up with any email.
3. Open Mailpit (http://127.0.0.1:55324) and type the 6 digit code from the email.

On a phone, the app reaches Supabase on your Mac automatically, as long as both are on the same wifi.
Login uses email codes until SMS sender registration (DLT) is approved. To switch, set
`EXPO_PUBLIC_LOGIN_METHOD=sms` in `apps/mobile/.env.local` and configure an SMS provider in Supabase.

## Everyday commands

```bash
npm test              # all unit tests
npm run typecheck
npm run lint
npm run db:test       # database rules (RLS, share lock, status moves)
npm run db:reset      # rebuild the local database from migrations and seed
npm run db:types      # regenerate packages/db types after a schema change
npm run check:login   # sign up, code, verify and profile against local Supabase

npm run dev:web       # member page on http://localhost:3456
npm run dev:mobile    # Expo. Scan the QR code with Expo Go on your phone.
```

## Rules for working here

- Money is always whole paise (`number` in TypeScript, `bigint` in Postgres). Never use rupee decimals in logic. Format only for display with `formatRupees`.
- Every money rule lives in `packages/core`, with tests. Apps call core and never do their own maths.
- Schema changes go in a new file in `supabase/migrations`. Never edit one that has been applied to staging or production.
- Secrets never go in git. Copy `.env.example` to `.env.local` where needed.
- One pull request per feature. CI runs type checks, lint, unit tests, the web build and database tests.

Decisions and gaps in the spec are tracked in [docs/decisions.md](docs/decisions.md).
