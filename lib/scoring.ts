import type {
  BestWeekScore,
  Game,
  HistoricalWeekResult,
  Membership,
  Pick,
  SeasonStanding,
  WeeklyEntry,
  WeeklySlate,
  WeeklyStanding,
  WeeklyStandingsGroup
} from "@/lib/types";

type ScoreInput = {
  memberships: Membership[];
  weeks: WeeklySlate[];
  games: Game[];
  picks: Pick[];
  weeklyEntries: WeeklyEntry[];
  historicalResults: HistoricalWeekResult[];
};

function getActualTiebreakTotal(week: WeeklySlate, games: Game[]) {
  const game = games.find((item) => item.id === week.tiebreak_game_id);

  if (!game || game.home_score === null || game.away_score === null) {
    return null;
  }

  return game.home_score + game.away_score;
}

export function buildWeeklyStandingsForWeek(
  week: WeeklySlate,
  memberships: Membership[],
  games: Game[],
  picks: Pick[],
  weeklyEntries: WeeklyEntry[],
  cashDeltaOverride?: Map<string, number>
): WeeklyStanding[] {
  const weekGames = games.filter((game) => game.week_id === week.id);
  const weekPicks = picks.filter((pick) =>
    weekGames.some((game) => game.id === pick.game_id)
  );
  const actualTiebreak = getActualTiebreakTotal(week, games);

  const standings = memberships.map((membership) => {
    const memberPicks = weekPicks.filter(
      (pick) => pick.membership_id === membership.id
    );

    const scored = memberPicks.reduce(
      (acc, pick) => {
        const game = weekGames.find((item) => item.id === pick.game_id);
        const isCorrect = Boolean(game?.winner_team && game.winner_team === pick.picked_team);

        return {
          points: acc.points + (isCorrect ? pick.confidence : 0),
          correctPicks: acc.correctPicks + (isCorrect ? 1 : 0)
        };
      },
      { points: 0, correctPicks: 0 }
    );

    const weeklyEntry = weeklyEntries.find(
      (entry) => entry.week_id === week.id && entry.membership_id === membership.id
    );
    const tiebreakPrediction = weeklyEntry?.tiebreak_total_runs ?? null;

    return {
      membershipId: membership.id,
      displayName: membership.display_name ?? "Unnamed player",
      points: scored.points,
      correctPicks: scored.correctPicks,
      tiebreakPrediction,
      tiebreakDiff:
        actualTiebreak === null || tiebreakPrediction === null
          ? null
          : Math.abs(actualTiebreak - tiebreakPrediction),
      isWinner: false,
      cashDelta: 0
    };
  });

  const sorted = standings.sort((left, right) => {
    if (right.points !== left.points) {
      return right.points - left.points;
    }

    if (left.tiebreakDiff === null && right.tiebreakDiff === null) {
      return left.displayName.localeCompare(right.displayName);
    }

    if (left.tiebreakDiff === null) {
      return 1;
    }

    if (right.tiebreakDiff === null) {
      return -1;
    }

    if (left.tiebreakDiff !== right.tiebreakDiff) {
      return left.tiebreakDiff - right.tiebreakDiff;
    }

    return left.displayName.localeCompare(right.displayName);
  });

  if (sorted[0]) {
    sorted[0].isWinner = true;
  }

  sorted.forEach((standing) => {
    standing.cashDelta = cashDeltaOverride
      ? cashDeltaOverride.get(standing.membershipId) ?? 0
      : standing.isWinner
        ? 120
        : -10;
  });

  return sorted;
}

function buildHistoricalWeeklyGroups(
  memberships: Membership[],
  historicalResults: HistoricalWeekResult[]
): WeeklyStandingsGroup[] {
  const grouped = new Map<number, HistoricalWeekResult[]>();

  historicalResults.forEach((result) => {
    const current = grouped.get(result.week_number) ?? [];
    current.push(result);
    grouped.set(result.week_number, current);
  });

  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([weekNumber, results]) => ({
      weekNumber,
      label: `Week ${weekNumber}`,
      source: "historical" as const,
      saturdayDate: null,
      standings: memberships
        .map((membership) => {
          const result = results.find(
            (item) => item.membership_id === membership.id
          );

          return {
            membershipId: membership.id,
            displayName: membership.display_name ?? "Unnamed player",
            points: result?.points ?? 0,
            correctPicks: result?.correct_picks ?? 0,
            tiebreakPrediction: null,
            tiebreakDiff: null,
            isWinner: (result?.cash_delta ?? 0) > 0,
            cashDelta: result?.cash_delta ?? 0
          };
        })
        .sort((left, right) => {
          if (right.points !== left.points) {
            return right.points - left.points;
          }

          return left.displayName.localeCompare(right.displayName);
        })
    }));
}

function buildLiveWeeklyGroups(input: ScoreInput, startingWeekNumber: number) {
  return [...input.weeks]
    .filter((week) => week.status === "final")
    .sort((left, right) =>
      left.saturday_date.localeCompare(right.saturday_date)
    )
    .map((week, index) => ({
      weekNumber: startingWeekNumber + index,
      label: `Week ${startingWeekNumber + index}`,
      source: "live" as const,
      saturdayDate: week.saturday_date,
      standings: buildWeeklyStandingsForWeek(
        week,
        input.memberships,
        input.games,
        input.picks,
        input.weeklyEntries
      )
    }));
}

export function buildStandingsSnapshot(input: ScoreInput): {
  bestWeekScores: BestWeekScore[];
  seasonStandings: SeasonStanding[];
  weeklyStandings: WeeklyStandingsGroup[];
  weekNumbers: number[];
} {
  const historicalGroups = buildHistoricalWeeklyGroups(
    input.memberships,
    input.historicalResults
  );
  const historicalMaxWeek = historicalGroups.at(-1)?.weekNumber ?? 0;
  const liveGroups = buildLiveWeeklyGroups(input, historicalMaxWeek + 1);
  const weeklyStandings = [...historicalGroups, ...liveGroups];
  const winCounts = new Map<string, number>();
  const seasonPoints = new Map<string, number>();
  const cashTotals = new Map<string, number>();
  const weekPointsByMembership = new Map<string, Record<number, number | null>>();
  let bestWeekPoints = Number.NEGATIVE_INFINITY;
  const bestWeekScores: BestWeekScore[] = [];

  weeklyStandings.forEach((group) => {
    group.standings.forEach((standing) => {
      seasonPoints.set(
        standing.membershipId,
        (seasonPoints.get(standing.membershipId) ?? 0) + standing.points
      );
      cashTotals.set(
        standing.membershipId,
        (cashTotals.get(standing.membershipId) ?? 0) + standing.cashDelta
      );
      if (standing.isWinner) {
        winCounts.set(
          standing.membershipId,
          (winCounts.get(standing.membershipId) ?? 0) + 1
        );
      }

      const existing = weekPointsByMembership.get(standing.membershipId) ?? {};
      existing[group.weekNumber] = standing.points;
      weekPointsByMembership.set(standing.membershipId, existing);

      if (standing.points > bestWeekPoints) {
        bestWeekPoints = standing.points;
        bestWeekScores.length = 0;
        bestWeekScores.push({
          membershipId: standing.membershipId,
          displayName: standing.displayName,
          weekNumber: group.weekNumber,
          points: standing.points
        });
      } else if (
        standing.points === bestWeekPoints &&
        Number.isFinite(bestWeekPoints)
      ) {
        bestWeekScores.push({
          membershipId: standing.membershipId,
          displayName: standing.displayName,
          weekNumber: group.weekNumber,
          points: standing.points
        });
      }
    });
  });

  const seasonStandings = input.memberships
    .map((membership) => ({
      membershipId: membership.id,
      displayName: membership.display_name ?? "Unnamed player",
      seasonPoints: seasonPoints.get(membership.id) ?? 0,
      weeklyWins: winCounts.get(membership.id) ?? 0,
      cashTotal: cashTotals.get(membership.id) ?? 0,
      weekPoints: weekPointsByMembership.get(membership.id) ?? {}
    }))
    .sort((left, right) => {
      if (right.seasonPoints !== left.seasonPoints) {
        return right.seasonPoints - left.seasonPoints;
      }

      if (right.weeklyWins !== left.weeklyWins) {
        return right.weeklyWins - left.weeklyWins;
      }

      return left.displayName.localeCompare(right.displayName);
    });

  return {
    bestWeekScores,
    seasonStandings,
    weeklyStandings,
    weekNumbers: weeklyStandings.map((group) => group.weekNumber)
  };
}
