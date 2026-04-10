import type {
  Game,
  Membership,
  Pick,
  SeasonStanding,
  WeeklyEntry,
  WeeklySlate,
  WeeklyStanding
} from "@/lib/types";

type ScoreInput = {
  memberships: Membership[];
  weeks: WeeklySlate[];
  games: Game[];
  picks: Pick[];
  weeklyEntries: WeeklyEntry[];
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
  weeklyEntries: WeeklyEntry[]
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
      isWinner: false
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

  return sorted;
}

export function buildSeasonStandings(input: ScoreInput): SeasonStanding[] {
  const winCounts = new Map<string, number>();
  const seasonPoints = new Map<string, number>();

  input.weeks.forEach((week) => {
    const weekStandings = buildWeeklyStandingsForWeek(
      week,
      input.memberships,
      input.games,
      input.picks,
      input.weeklyEntries
    );

    weekStandings.forEach((standing) => {
      seasonPoints.set(
        standing.membershipId,
        (seasonPoints.get(standing.membershipId) ?? 0) + standing.points
      );
      if (standing.isWinner) {
        winCounts.set(
          standing.membershipId,
          (winCounts.get(standing.membershipId) ?? 0) + 1
        );
      }
    });
  });

  return input.memberships
    .map((membership) => ({
      membershipId: membership.id,
      displayName: membership.display_name ?? "Unnamed player",
      seasonPoints: seasonPoints.get(membership.id) ?? 0,
      weeklyWins: winCounts.get(membership.id) ?? 0
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
}
