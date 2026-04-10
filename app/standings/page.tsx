import { format } from "date-fns";
import Link from "next/link";
import { getStandingsData } from "@/lib/data";
import { parseSaturdayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const { seasonStandings, weeklyStandings, weekNumbers } = await getStandingsData();

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
                <th>$ total</th>
              </tr>
            </thead>
            <tbody>
              {seasonStandings.map((row) => (
                <tr key={row.membershipId}>
                  <td>{row.displayName}</td>
                  <td>{row.seasonPoints}</td>
                  <td>{row.weeklyWins}</td>
                  <td>{row.cashTotal >= 0 ? `+${row.cashTotal}` : row.cashTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-card">
        <div className="section-head">
          <h2>Season matrix</h2>
          <Link href="/history-import" className="text-link">
            Import historical weeks
          </Link>
        </div>
        {weekNumbers.length === 0 ? (
          <div className="empty">Week columns will appear after historical imports or final live results.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  {weekNumbers.map((weekNumber) => (
                    <th key={weekNumber}>W{weekNumber}</th>
                  ))}
                  <th>Total</th>
                  <th>Wins</th>
                  <th>$</th>
                </tr>
              </thead>
              <tbody>
                {seasonStandings.map((row) => (
                  <tr key={row.membershipId}>
                    <td>{row.displayName}</td>
                    {weekNumbers.map((weekNumber) => (
                      <td key={weekNumber}>{row.weekPoints[weekNumber] ?? "-"}</td>
                    ))}
                    <td>{row.seasonPoints}</td>
                    <td>{row.weeklyWins}</td>
                    <td>{row.cashTotal >= 0 ? `+${row.cashTotal}` : row.cashTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section-card">
        <h2>Weekly results</h2>
        {weeklyStandings.length === 0 ? (
          <div className="empty">Weekly standings will appear after the first slate syncs.</div>
        ) : (
          <div className="game-list">
            {weeklyStandings.map((group) => (
              <div key={`${group.source}-${group.weekNumber}`} className="week-block">
                <h3>
                  {group.label}
                  {group.saturdayDate
                    ? ` - ${format(parseSaturdayKey(group.saturdayDate), "MMMM d, yyyy")}`
                    : " - Imported history"}
                </h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Points</th>
                        <th>Correct</th>
                        <th>$</th>
                        <th>Tiebreak</th>
                        <th>Week winner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.standings.map((row) => (
                        <tr key={row.membershipId}>
                          <td>{row.displayName}</td>
                          <td>{row.points}</td>
                          <td>{row.correctPicks}</td>
                          <td>{row.cashDelta >= 0 ? `+${row.cashDelta}` : row.cashDelta}</td>
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
