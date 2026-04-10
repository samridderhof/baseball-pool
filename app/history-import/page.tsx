import Link from "next/link";
import {
  importHistoricalResultsAction,
  saveImportLabelsAction
} from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getHistoricalImportData } from "@/lib/data";

export const dynamic = "force-dynamic";

type HistoryImportPageProps = {
  searchParams: Promise<{
    saved?: string;
    rows?: string;
    error?: string;
  }>;
};

export default async function HistoryImportPage({
  searchParams
}: HistoryImportPageProps) {
  const params = await searchParams;
  const { memberships, historicalResults } = await getHistoricalImportData();
  const importedWeeks = [...new Set(historicalResults.map((row) => row.week_number))];

  return (
    <div className="page-grid">
      <section className="section-card">
        <span className="eyebrow">Commissioner tools</span>
        <h2>Historical results import</h2>
        <p>
          Use import labels to match spreadsheet names like <strong>SAM</strong> or
          <strong> JOHN L</strong> to site members, then paste normalized weekly results
          as CSV.
        </p>
        {params.saved === "labels" ? <p><strong>Import labels saved.</strong></p> : null}
        {params.saved === "history" ? (
          <p>
            <strong>Historical results imported.</strong> {params.rows ?? "0"} rows processed.
          </p>
        ) : null}
        {params.error ? <p><strong>{params.error}</strong></p> : null}
        <p className="muted">
          Imported weeks on file:{" "}
          {importedWeeks.length > 0 ? importedWeeks.join(", ") : "none yet"}.
        </p>
      </section>

      <section className="section-card">
        <h2>Step 1: Import labels</h2>
        <p>
          Add the short names from your spreadsheet so the importer can match each row
          to the right player.
        </p>
        <form action={saveImportLabelsAction} className="form-grid">
          <div className="game-list">
            {memberships.map((member) => (
              <article key={member.id} className="game-card">
                <div className="split-grid">
                  <div className="info-card">
                    <strong>{member.display_name}</strong>
                    <span className="muted">Current site name</span>
                  </div>
                  <label className="field">
                    Import label
                    <input
                      type="text"
                      name={`importLabel:${member.id}`}
                      defaultValue={member.import_label ?? ""}
                      placeholder="Example: SAM"
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
          <SubmitButton label="Save import labels" pendingLabel="Saving labels..." />
        </form>
      </section>

      <section className="section-card">
        <h2>Step 2: Paste historical results CSV</h2>
        <p>
          Format:
          <code> week,player,correct_picks,points,cash_delta</code>
        </p>
        <p className="muted">
          Example rows:
          <br />
          <code>1,SAM,9,79,-10</code>
          <br />
          <code>1,FRANK O,11,95,120</code>
        </p>
        <form action={importHistoricalResultsAction} className="form-grid">
          <label className="field">
            Historical results CSV
            <textarea
              name="historicalCsv"
              rows={14}
              className="textarea"
              placeholder={
                "week,player,correct_picks,points,cash_delta\n1,SAM,9,79,-10\n1,FRANK O,11,95,120"
              }
              required
            />
          </label>
          <SubmitButton label="Import historical results" pendingLabel="Importing..." />
        </form>
      </section>

      <section className="section-card">
        <h2>Next stop</h2>
        <p>
          Once imported, open the season matrix on the standings page to verify the
          week-by-week points and <code>$</code> totals.
        </p>
        <Link href="/standings" className="btn">
          Open standings
        </Link>
      </section>
    </div>
  );
}
