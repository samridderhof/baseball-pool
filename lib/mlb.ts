import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { saturdayKey } from "@/lib/dates";
import type { Game, WeeklySlate } from "@/lib/types";

type MlbScheduleResponse = {
  dates: Array<{
    games: Array<{
      gamePk: number;
      gameDate: string;
      officialDate: string;
      rescheduleDate?: string;
      rescheduleGameDate?: string;
      rescheduledFrom?: string;
      rescheduledFromDate?: string;
      status: {
        detailedState: string;
        abstractGameState: string;
        statusCode: string;
      };
      teams: {
        away: {
          team: {
            name: string;
          };
          score?: number;
        };
        home: {
          team: {
            name: string;
          };
          score?: number;
        };
      };
    }>;
  }>;
};

type MlbGame = MlbScheduleResponse["dates"][number]["games"][number];

function addDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function fetchScheduleForDate(key: string) {
  const response = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${key}`,
    {
      next: {
        revalidate: 300
      }
    }
  );

  if (!response.ok) {
    throw new Error("Unable to load MLB schedule.");
  }

  const payload = (await response.json()) as MlbScheduleResponse;
  return payload.dates[0]?.games ?? [];
}

function mapWinner(game: MlbGame) {
  const awayScore = game.teams.away.score;
  const homeScore = game.teams.home.score;

  if (typeof awayScore !== "number" || typeof homeScore !== "number") {
    return null;
  }

  if (awayScore === homeScore) {
    return null;
  }

  return awayScore > homeScore
    ? game.teams.away.team.name
    : game.teams.home.team.name;
}

function getRescheduledDate(game: MlbGame, originalDate: string) {
  if (game.rescheduleGameDate) {
    return game.rescheduleGameDate;
  }

  if (game.rescheduledFromDate === originalDate) {
    return game.officialDate;
  }

  if (game.officialDate !== originalDate) {
    return game.officialDate;
  }

  return null;
}

function shouldCountForSaturdaySlate(
  game: MlbGame,
  originalDate: string,
  nextDate: string
) {
  const makeupDate = getRescheduledDate(game, originalDate);

  if (!makeupDate) {
    return true;
  }

  return makeupDate === nextDate;
}

function isCompletedGame(game: MlbGame) {
  return (
    game.status.abstractGameState === "Final" &&
    !["Postponed", "Cancelled", "Canceled"].includes(game.status.detailedState) &&
    typeof game.teams.away.score === "number" &&
    typeof game.teams.home.score === "number"
  );
}

function getSlateStatus(games: MlbGame[]): WeeklySlate["status"] {
  if (games.length === 0) {
    return "upcoming";
  }

  if (games.every(isCompletedGame)) {
    return "final";
  }

  if (games.every((game) => game.status.abstractGameState === "Preview")) {
    return "upcoming";
  }

  return "live";
}

export async function syncSaturdaySlate(
  leagueId: string,
  saturdayDate: Date
): Promise<{ slate: WeeklySlate; games: Game[] }> {
  const admin = createSupabaseAdminClient();
  const key = saturdayKey(saturdayDate);
  const nextDayKey = addDays(key, 1);
  const [saturdayGames, nextDayGames] = await Promise.all([
    fetchScheduleForDate(key),
    fetchScheduleForDate(nextDayKey)
  ]);
  const nextDayMakeups = new Map(
    nextDayGames
      .filter((game) => game.rescheduledFromDate === key)
      .map((game) => [game.gamePk, game] as const)
  );
  const slateGames = saturdayGames
    .filter((game) => shouldCountForSaturdaySlate(game, key, nextDayKey))
    .map((game) => nextDayMakeups.get(game.gamePk) ?? game);
  const status = getSlateStatus(slateGames);

  const { data: slate, error: slateError } = await admin
    .from("weekly_slates")
    .upsert(
      {
        league_id: leagueId,
        saturday_date: key,
        status
      },
      {
        onConflict: "league_id,saturday_date"
      }
    )
    .select()
    .single();

  if (slateError || !slate) {
    throw slateError ?? new Error("Unable to create weekly slate.");
  }

  const mappedGames = slateGames.map((game, index) => ({
    external_id: game.gamePk,
    week_id: slate.id,
    starts_at: game.gameDate,
    away_team: game.teams.away.team.name,
    home_team: game.teams.home.team.name,
    away_score: game.teams.away.score ?? null,
    home_score: game.teams.home.score ?? null,
    status: game.status.detailedState,
    winner_team: mapWinner(game),
    sort_order: index + 1
  }));

  if (mappedGames.length > 0) {
    const { error: gamesError } = await admin.from("games").upsert(mappedGames, {
      onConflict: "external_id"
    });

    if (gamesError) {
      throw gamesError;
    }
  }

  if (mappedGames.length === 0) {
    const { error: cleanupError } = await admin
      .from("games")
      .delete()
      .eq("week_id", slate.id);

    if (cleanupError) {
      throw cleanupError;
    }
  } else {
    const externalIds = mappedGames.map((game) => game.external_id).join(",");
    const { error: cleanupError } = await admin
      .from("games")
      .delete()
      .eq("week_id", slate.id)
      .not("external_id", "in", `(${externalIds})`);

    if (cleanupError) {
      throw cleanupError;
    }
  }

  const { data: storedGames, error: storedGamesError } = await admin
    .from("games")
    .select("*")
    .eq("week_id", slate.id)
    .order("sort_order", { ascending: true });

  if (storedGamesError || !storedGames) {
    throw storedGamesError ?? new Error("Unable to load games.");
  }

  const lastGame = storedGames.at(-1);

  if (slate.tiebreak_game_id !== (lastGame?.id ?? null)) {
    const { error: updateError } = await admin
      .from("weekly_slates")
      .update({ tiebreak_game_id: lastGame?.id ?? null })
      .eq("id", slate.id);

    if (updateError) {
      throw updateError;
    }
  }

  return {
    slate: {
      ...slate,
      tiebreak_game_id: lastGame?.id ?? slate.tiebreak_game_id
    },
    games: storedGames as Game[]
  };
}
