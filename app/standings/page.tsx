import { format } from "date-fns";
import { getStandingsData } from "@/lib/data";
import { parseSaturdayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const { seasonStandings, weeklyStandings } = await getStandingsData();

  return (
    <div className="page-grid">
      <section className="section-card">
        <span className="eyebrow">Standings</span>
        <h2>Season totals</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Season points</th>
                <th>Weekly wins</th>
              </tr>
            </thead>
            <tbody>
              {seasonStandings.map((row) => (
                <tr key={row.membershipId}>
                  <td>{row.displayName}</td>
                  <td>{row.seasonPoints}</td>
                  <td>{row.weeklyWins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-card">
        <h2>Weekly results</h2>
        {weeklyStandings.length === 0 ? (
          <div className="empty">Weekly standings will appear after the first slate syncs.</div>
        ) : (
          <div className="game-list">
            {weeklyStandings.map(({ week, standings }) => (
              <div key={week.id} className="week-block">
                <h3>{format(parseSaturdayKey(week.saturday_date), "MMMM d, yyyy")}</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Points</th>
                        <th>Correct</th>
                        <th>Tiebreak</th>
                        <th>Week winner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((row) => (
                        <tr key={row.membershipId}>
                          <td>{row.displayName}</td>
                          <td>{row.points}</td>
                          <td>{row.correctPicks}</td>
                          <td>
                            {row.tiebreakPrediction ?? "-"}
                            {row.tiebreakDiff !== null ? ` (${row.tiebreakDiff} off)` : ""}
                          </td>
                          <td>{row.isWinner ? "Yes" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
