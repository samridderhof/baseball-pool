import Link from "next/link";
import { format } from "date-fns";
import { signOutAction } from "@/app/actions";
import { getCurrentWeekData } from "@/lib/data";
import { parseSaturdayKey } from "@/lib/dates";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { membership, slate, games, weeklyEntry, completionStatus } =
    await getCurrentWeekData();
  const lockedCount = games.filter((game) => game.locked).length;
  const completedCount = games.filter((game) => game.pick).length;

  return (
    <div className="page-grid">
      <section className="hero">
        <span className="eyebrow">Dashboard</span>
        <h1>Welcome back, {membership.display_name ?? "player"}.</h1>
        <p>
          Saturday slate for {format(parseSaturdayKey(slate.saturday_date), "MMMM d, yyyy")}. Picks
          lock at each game&apos;s first pitch.
        </p>
        <div className="cta-row">
          <Link href="/picks" className="btn">
            Set picks
          </Link>
          <Link href="/standings" className="btn-secondary">
            Open standings
          </Link>
        </div>
      </section>

      <section className="section-card">
        <h2>This week at a glance</h2>
        <div className="stat-grid">
          <div className="stat">
            Games on slate
            <strong>{games.length}</strong>
            <span className="muted">Confidence scale runs from 1 through {games.length}.</span>
          </div>
          <div className="stat">
            Picks saved
            <strong>{completedCount}</strong>
            <span className="muted">You can update any game until it locks.</span>
          </div>
          <div className="stat">
            Locked now
            <strong>{lockedCount}</strong>
            <span className="muted">
              Tiebreaker: {weeklyEntry?.tiebreak_total_runs ?? "not set yet"} total runs.
            </span>
          </div>
        </div>
      </section>

      <section className="section-card">
        <h2>Quick rules</h2>
        <div className="info-grid">
          <div className="info-card">
            <strong>Weekly winner</strong>
            <span className="muted">Most confidence points wins the week.</span>
          </div>
          <div className="info-card">
            <strong>Tiebreaker</strong>
            <span className="muted">
              Closest guess on total runs in the last Saturday game wins the tie.
            </span>
          </div>
          <div className="info-card">
            <strong>Season race</strong>
            <span className="muted">
              Season standings track total points and every weekly crown.
            </span>
          </div>
        </div>
      </section>

      <section className="section-card">
        <h2>League activity</h2>
        <p>See who has saved their picks without revealing any actual selections.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Picks saved</th>
                <th>Tiebreaker</th>
              </tr>
            </thead>
            <tbody>
              {completionStatus.map((row) => (
                <tr key={row.membershipId}>
                  <td>{row.displayName}</td>
                  <td>
                    {row.savedCount}/{row.totalGames}
                  </td>
                  <td>{row.hasTiebreaker ? "Saved" : "Not yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-card">
        <h2>Session</h2>
        <form action={signOutAction}>
          <SubmitButton label="Sign out" pendingLabel="Signing out..." />
        </form>
      </section>
    </div>
  );
}
