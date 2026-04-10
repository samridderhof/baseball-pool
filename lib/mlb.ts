import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { saturdayKey } from "@/lib/dates";
import type { Game, WeeklySlate } from "@/lib/types";

type MlbScheduleResponse = {
  dates: Array<{
    games: Array<{
      gamePk: number;
      gameDate: string;
      status: {
        detailedState: string;
        abstractGameState: string;
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

function mapWinner(game: MlbScheduleResponse["dates"][number]["games"][number]) {
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

export async function syncSaturdaySlate(
  leagueId: string,
  saturdayDate: Date
): Promise<{ slate: WeeklySlate; games: Game[] }> {
  const admin = createSupabaseAdminClient();
  const key = saturdayKey(saturdayDate);

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
  const games = payload.dates[0]?.games ?? [];

  const status = games.some((game) => game.status.abstractGameState === "Final")
    ? games.every((game) => game.status.abstractGameState === "Final")
      ? "final"
      : "live"
    : "upcoming";

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

  const mappedGames = games.map((game, index) => ({
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

  const { data: storedGames, error: storedGamesError } = await admin
    .from("games")
    .select("*")
    .eq("week_id", slate.id)
    .order("sort_order", { ascending: true });

  if (storedGamesError || !storedGames) {
    throw storedGamesError ?? new Error("Unable to load games.");
  }

  const lastGame = storedGames.at(-1);

  if (lastGame && slate.tiebreak_game_id !== lastGame.id) {
    const { error: updateError } = await admin
      .from("weekly_slates")
      .update({ tiebreak_game_id: lastGame.id })
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
