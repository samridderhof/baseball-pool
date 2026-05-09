import Link from "next/link";
import { format } from "date-fns";
import { signOutAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentWeekData } from "@/lib/data";
import { formatEasternDateTime, parseSaturdayKey } from "@/lib/dates";
import type { GameWithPick } from "@/lib/types";

export const dynamic = "force-dynamic";

type PickOutcome = {
  key: "earning" | "tied" | "trailing" | "pending" | "open";
  label: string;
  pointsLabel: string;
  detail: string;
};

function getPickOutcome(game: GameWithPick): PickOutcome {
  if (!game.pick) {
    return {
      key: "open",
      label: "Pick open",
      pointsLabel: "0 pts",
      detail: "Choose a side before first pitch."
    };
  }

  if (!game.locked || game.away_score === null || game.home_score === null) {
    return {
      key: "pending",
      label: "Not started",
      pointsLabel: `+${game.pick.confidence} possible`,
      detail: `${game.pick.picked_team} for ${game.pick.confidence}.`
    };
  }

  if (game.away_score === game.home_score) {
    return {
      key: "tied",
      label: "Game tied",
      pointsLabel: `+${game.pick.confidence} in play`,
      detail: `${game.pick.picked_team} is still alive.`
    };
  }

  const leadingTeam = game.away_score > game.home_score ? game.away_team : game.home_team;

  if (leadingTeam === game.pick.picked_team) {
    return {
      key: "earning",
      label: "Currently earning",
      pointsLabel: `+${game.pick.confidence} pts`,
      detail: `${game.pick.picked_team} is ahead.`
    };
  }

  return {
    key: "trailing",
    label: "Currently losing",
    pointsLabel: "0 pts",
    detail: `${game.pick.picked_team} is behind.`
  };
}

function TeamScore({
  team,
  score,
  align = "left"
}: {
  team: string;
  score: number | null;
  align?: "left" | "right";
}) {
  return (
    <div className={`team-score ${align === "right" ? "right" : ""}`}>
      <span>{team}</span>
      <strong>{score ?? "-"}</strong>
    </div>
  );
}

function StatusDot({ locked }: { locked: boolean }) {
  return <span className={`status-dot ${locked ? "locked" : ""}`} aria-hidden="true" />;
}

export default async function DashboardPage() {
  const {
    membership,
    slate,
    games,
    weeklyEntry,
    completionStatus,
    currentWeekLeaderboard,
    livePickRevealGames
  } = await getCurrentWeekData();
  const lockedCount = games.filter((game) => game.locked).length;
  const completedCount = games.filter((game) => game.pick).length;
  const revealCount = livePickRevealGames.filter((game) => game.locked).length;
  const slateLabel = format(parseSaturdayKey(slate.saturday_date), "MMMM d, yyyy");
  const hasLockedGames = livePickRevealGames.some((game) => game.locked);

  return (
    <div className="page-grid sports-variant">
      <section className="sports-hero">
        <div>
          <span className="eyebrow">Saturday slate</span>
          <h1>{slateLabel}</h1>
          <p>
            Welcome back, {membership.display_name ?? "player"}. First pitch locks each
            matchup, and live points update as scores come in.
          </p>
        </div>
        <div className="sports-action-panel">
          <Link href="/picks" className="btn">
            Set picks
          </Link>
          <Link href="/standings" className="btn-secondary">
            Standings
          </Link>
        </div>
      </section>

      <section className="sports-score-strip" aria-label="Weekly dashboard summary">
        <div>
          <span>Saved</span>
          <strong>
            {completedCount}/{games.length}
          </strong>
        </div>
        <div>
          <span>Locked</span>
          <strong>{lockedCount}</strong>
        </div>
        <div>
          <span>Tiebreak</span>
          <strong>{weeklyEntry?.tiebreak_total_runs ?? "Open"}</strong>
        </div>
        <div>
          <span>Reveals</span>
          <strong>{revealCount}</strong>
        </div>
      </section>

      <section className="leaderboard-panel">
        <div className="design-section-head">
          <div>
            <h2>Live leaderboard</h2>
            <p>Weekly points update as locked games move through the slate.</p>
          </div>
          <Link href="/standings" className="text-link">
            Full standings
          </Link>
        </div>
        <div className="leaderboard-list">
          {currentWeekLeaderboard.map((row, index) => (
            <div key={row.membershipId} className="leaderboard-row">
              <span>#{index + 1}</span>
              <div>
                <strong>{row.displayName}</strong>
                <small>
                  {row.liveCorrectPicks} correct - {row.seasonPoints} season pts
                </small>
              </div>
              <b>{row.livePoints}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="sports-layout">
        <div className="sports-main">
          <div className="design-section-head">
            <h2>Matchups</h2>
            <span>{games.length} games</span>
          </div>
          <div className="matchup-list">
            {games.map((game) => {
              const outcome = getPickOutcome(game);

              return (
                <article key={game.id} className={`matchup-card outcome-${outcome.key}`}>
                  <div className="matchup-time">
                    <StatusDot locked={game.locked} />
                    {formatEasternDateTime(game.starts_at)} ET
                  </div>
                  <div className="matchup-board">
                    <TeamScore team={game.away_team} score={game.away_score} />
                    <span className="versus">at</span>
                    <TeamScore team={game.home_team} score={game.home_score} align="right" />
                  </div>
                  <div className="matchup-live-row">
                    <div className="matchup-meta">
                      <span>{game.status}</span>
                      <strong>
                        {game.pick
                          ? `${game.pick.picked_team} - ${game.pick.confidence}`
                          : "Pick open"}
                      </strong>
                    </div>
                    <div className={`points-signal ${outcome.key}`}>
                      <span>{outcome.label}</span>
                      <strong>{outcome.pointsLabel}</strong>
                      <small>{outcome.detail}</small>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="sports-sidebar">
          <section>
            <div className="design-section-head compact">
              <h2>League activity</h2>
              <span>{completionStatus.length} players</span>
            </div>
            <div className="activity-list">
              {completionStatus.map((row) => (
                <div key={row.membershipId} className="activity-row">
                  <div>
                    <strong>{row.displayName}</strong>
                    <small>{row.hasTiebreaker ? "Tiebreaker saved" : "Tiebreaker open"}</small>
                  </div>
                  <span>
                    {row.savedCount}/{row.totalGames}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="design-section-head compact">
              <h2>Session</h2>
            </div>
            <form action={signOutAction}>
              <SubmitButton label="Sign out" pendingLabel="Signing out..." />
            </form>
          </section>
        </aside>
      </section>

      <section className="section-card">
        <div className="section-head">
          <div>
            <h2>Locked game pick reveals</h2>
            <p>
              Once a game locks, everyone can see the pick and confidence tied to that
              matchup.
            </p>
          </div>
          <span className="pill">{revealCount} revealed</span>
        </div>
        {!hasLockedGames ? (
          <div className="empty">No games have locked yet for {slateLabel}.</div>
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
                      {formatEasternDateTime(game.startsAt)} ET | {game.status}
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
    </div>
  );
}
