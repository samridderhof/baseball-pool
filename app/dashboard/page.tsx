import Link from "next/link";
import { format } from "date-fns";
import { signOutAction } from "@/app/actions";
import { getCurrentWeekData } from "@/lib/data";
import { parseSaturdayKey } from "@/lib/dates";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const {
    membership,
    slate,
    games,
    weeklyEntry,
    completionStatus,
    currentWeekLeaderboard,
    livePickRevealGames
  } =
    await getCurrentWeekData();
  const lockedCount = games.filter((game) => game.locked).length;
  const completedCount = games.filter((game) => game.pick).length;
  const hasLockedGames = livePickRevealGames.some((game) => game.locked);

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
        <p>
          See who has saved their picks before first pitch. Locked games reveal
          picks and confidence publicly once they go live.
        </p>
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
        <h2>Live Saturday leaderboard</h2>
        <p>
          Once a game locks, everyone can see the pick and confidence tied to that
          matchup. Season totals stay visible alongside the live week race.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Live points</th>
                <th>Live correct</th>
                <th>Season points</th>
                <th>Season correct</th>
              </tr>
            </thead>
            <tbody>
              {currentWeekLeaderboard.map((row) => (
                <tr key={row.membershipId}>
                  <td>{row.displayName}</td>
                  <td>{row.livePoints}</td>
                  <td>{row.liveCorrectPicks}</td>
                  <td>{row.seasonPoints}</td>
                  <td>{row.seasonCorrectPicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-card">
        <h2>Locked game pick reveals</h2>
        <p>
          Games stay private until first pitch. After lock, every submitted pick and
          confidence number for that game is visible here.
        </p>
        {!hasLockedGames ? (
          <div className="empty">
            No games have locked yet for {format(parseSaturdayKey(slate.saturday_date), "MMMM d, yyyy")}.
          </div>
        ) : (
          <div className="game-list">
            {livePickRevealGames.map((game) => (
              <div key={game.gameId} className="week-block">
                <div className="section-head">
                  <div>
                    <h3>
                      {game.awayTeam} at {game.homeTeam}
                    </h3>
                    <p className="matrix-callout">
                      {format(new Date(game.startsAt), "EEE h:mm a")} | {game.status}
                    </p>
                  </div>
                  <span className={`pill${game.locked ? " locked" : ""}`}>
                    {game.locked ? "Revealed" : "Hidden until lock"}
                  </span>
                </div>
                {game.locked ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Pick</th>
                          <th>Confidence</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {game.reveals.map((reveal) => (
                          <tr key={reveal.membershipId}>
                            <td>{reveal.displayName}</td>
                            <td>{reveal.pickedTeam}</td>
                            <td>{reveal.confidence}</td>
                            <td>
                              {game.winnerTeam
                                ? reveal.pickedTeam === game.winnerTeam
                                  ? "Correct"
                                  : "Miss"
                                : "Pending"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty">
                    Picks for this game will appear automatically at first pitch.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
