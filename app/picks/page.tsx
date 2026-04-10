import { format } from "date-fns";
import { PicksForm } from "@/components/picks-form";
import { getCurrentWeekData } from "@/lib/data";
import { parseSaturdayKey } from "@/lib/dates";

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
  const { slate, games, weeklyEntry, completionStatus } = await getCurrentWeekData();
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
          <PicksForm weekId={slate.id} games={games} weeklyEntry={weeklyEntry} />
        )}
      </section>

      <section className="section-card">
        <h2>League activity</h2>
        <p>Everyone can see submission progress, but never the actual picks.</p>
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
    </div>
  );
}
