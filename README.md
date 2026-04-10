# Saturday Slugfest

Private weekly MLB confidence pool built with Next.js + Supabase.

## What this ships in v1

- Invite-only join flow for one private league per user
- Email/password auth with Supabase
- Saturday MLB slate sync from the public MLB Stats API
- Winner picks plus confidence values from `1..N`
- Tiebreaker on total runs in the last Saturday game
- Game-level locking once first pitch starts
- Weekly winners, weekly standings, and season standings
- Mobile-friendly UI with baseball-themed visuals

## Stack

- Next.js App Router
- Supabase Auth + Postgres
- Public MLB Stats API for schedule and scores

## Local setup

1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SITE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. In Supabase SQL editor, run `supabase/schema.sql`.
4. Run `supabase/seed.sql` and replace the invite code with your real one.
5. Install dependencies with `npm install`.
6. Start the app with `npm run dev`.

## Historical imports

- Existing Supabase projects should also run `supabase/history-upgrade.sql`.
- Members can set import labels and paste normalized CSV rows at `/history-import`.
- Expected CSV format:
  - `week,player,correct_picks,points,cash_delta`
- Example:
  - `1,SAM,9,79,-10`
  - `1,FRANK O,11,95,120`

## Spreadsheet conversion helper

- To convert the existing Excel tracker into import-ready CSV:
  - `python scripts/export_history_csv.py "C:\path\to\Baseball Pool 2026.xlsx"`
- The script writes a `.history.csv` file beside the workbook.

## Notes

- The app syncs the current Saturday slate on demand when authenticated pages load.
- The sync uses the Supabase service role on the server so it can upsert slate and game data safely.
- Users can still update unlocked games later in the day; locked games stay frozen.
- Weekly winners are derived from points first, then closest tiebreak total.
- `vercel.json` includes a daily keep-alive cron hitting `/api/keep-alive` to reduce inactivity risk on low-traffic weeks.
