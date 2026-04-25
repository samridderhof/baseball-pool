"use client";

import { useMemo, useState } from "react";
import { savePicksAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { formatEasternDateTime } from "@/lib/dates";
import type { GameWithPick, WeeklyEntry } from "@/lib/types";

type PicksFormProps = {
  weekId: string;
  games: GameWithPick[];
  weeklyEntry: WeeklyEntry | null;
};

export function PicksForm({ weekId, games, weeklyEntry }: PicksFormProps) {
  const [selectedConfidenceByGame, setSelectedConfidenceByGame] = useState<
    Record<string, string>
  >(
    Object.fromEntries(
      games.map((game) => [game.id, game.pick?.confidence?.toString() ?? ""])
    )
  );

  const selectedConfidenceValues = useMemo(
    () =>
      new Set(
        Object.values(selectedConfidenceByGame).filter(
          (value) => value.length > 0
        )
      ),
    [selectedConfidenceByGame]
  );

  return (
    <form action={savePicksAction} className="form-grid">
      <input type="hidden" name="weekId" value={weekId} />
      <div className="game-list">
        {games.map((game) => {
          const selectedValue = selectedConfidenceByGame[game.id] ?? "";

          return (
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
                    {formatEasternDateTime(game.starts_at)} ET
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
                    value={selectedValue}
                    onChange={(event) =>
                      setSelectedConfidenceByGame((current) => ({
                        ...current,
                        [game.id]: event.target.value
                      }))
                    }
                    disabled={game.locked}
                  >
                    <option value="">Choose</option>
                    {Array.from({ length: games.length }, (_, index) => index + 1).map(
                      (value) => {
                        const optionValue = value.toString();
                        const isTakenElsewhere =
                          selectedConfidenceValues.has(optionValue) &&
                          selectedValue !== optionValue;

                        return (
                          <option
                            key={value}
                            value={optionValue}
                            disabled={isTakenElsewhere}
                          >
                            {value}
                          </option>
                        );
                      }
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
          );
        })}
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
  );
}
