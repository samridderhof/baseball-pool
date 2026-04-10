import { format } from "date-fns";
import { savePicksAction } from "@/app/actions";
import { getCurrentWeekData } from "@/lib/data";
import { parseSaturdayKey } from "@/lib/dates";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

type PicksPageProps = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
};

const pickErrors: Record<string, string> = {
  confidence: "Confidence values must be unique and stay between 1 and the total game count.",
  "missing-week": "The current week could not be loaded."
};

export default async function PicksPage({ searchParams }: PicksPageProps) {
  const params = await searchParams;
  const { slate, games, weeklyEntry } = await getCurrentWeekData();
  const hasGames = games.length > 0;

  return (
    <div className="page-grid">
      <section className="section-card">
        <span className="eyebrow">Saturday picks</span>
        <h2>{format(parseSaturdayKey(slate.saturday_date), "MMMM d, yyyy")}</h2>
        <p>
          Pick the winner of each Saturday MLB game, assign your confidence score,
          and set the tiebreaker for the final game on the slate.
        </p>
        {params.saved ? <p><strong>Your picks were saved.</strong></p> : null}
        {params.error ? <p><strong>{pickErrors[params.error] ?? params.error}</strong></p> : null}
      </section>

      <section className="section-card">
        {!hasGames ? (
          <div className="empty">No Saturday MLB games were returned for this slate yet.</div>
        ) : (
          <form action={savePicksAction} className="form-grid">
            <input type="hidden" name="weekId" value={slate.id} />
            <div className="game-list">
              {games.map((game) => (
                <article
                  key={game.id}
                  className={`game-card${game.locked ? " locked" : ""}`}
                >
                  <div className="game-row">
                    <div>
                      <strong>
                        {game.away_team} at {game.home_team}
                      </strong>
                      <div className="muted">
                        {format(new Date(game.starts_at), "EEE h:mm a")}
                      </div>
                    </div>
                    <span className={`pill${game.locked ? " locked" : ""}`}>
                      {game.locked ? "Locked" : "Open"}
                    </span>
                  </div>

                  <div className="split-grid">
                    <label className="field">
                      Winner
                      <select
                        name={`pick:${game.id}`}
                        defaultValue={game.pick?.picked_team ?? ""}
                        disabled={game.locked}
                      >
                        <option value="">Select team</option>
                        <option value={game.away_team}>{game.away_team}</option>
                        <option value={game.home_team}>{game.home_team}</option>
                      </select>
                    </label>

                    <label className="field">
                      Confidence
                      <select
                        name={`confidence:${game.id}`}
                        defaultValue={game.pick?.confidence?.toString() ?? ""}
                        disabled={game.locked}
                      >
                        <option value="">Choose</option>
                        {Array.from({ length: games.length }, (_, index) => index + 1).map(
                          (value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                  </div>

                  {game.status.toLowerCase().includes("final") &&
                  game.home_score !== null &&
                  game.away_score !== null ? (
                    <div className="muted">
                      Final: {game.away_team} {game.away_score}, {game.home_team}{" "}
                      {game.home_score}
                    </div>
                  ) : (
                    <div className="muted">{game.status}</div>
                  )}
                </article>
              ))}
            </div>

            <label className="field">
              Tiebreaker: total runs in the last Saturday game
              <input
                type="number"
                name="tiebreak"
                min={0}
                max={99}
                defaultValue={weeklyEntry?.tiebreak_total_runs ?? ""}
                required
              />
            </label>

            <SubmitButton label="Save picks" pendingLabel="Saving picks..." />
          </form>
        )}
      </section>
    </div>
  );
}
