import "server-only";

import { redirect } from "next/navigation";
import { getActiveSaturday } from "@/lib/dates";
import { syncSaturdaySlate } from "@/lib/mlb";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildStandingsSnapshot } from "@/lib/scoring";
import type {
  CurrentWeekLeaderboardRow,
  Game,
  GameWithPick,
  HistoricalWeekResult,
  LivePickRevealGame,
  Membership,
  Pick,
  PickCompletionStatus,
  WeeklyEntry,
  WeeklySlate
} from "@/lib/types";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getMembershipForUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("league_memberships")
    .select("id, league_id, user_id, display_name, import_label")
    .eq("user_id", userId)
    .maybeSingle();

  return data as Membership | null;
}

export async function requireMembership() {
  const user = await requireUser();
  const membership = await getMembershipForUser(user.id);

  if (!membership) {
    redirect("/");
  }

  return { user, membership };
}

export async function getLeagueByInviteCode(inviteCode: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("leagues")
    .select("id, name, invite_code, season_year")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  return data;
}

export async function getCurrentWeekData() {
  const { membership } = await requireMembership();
  const { slate, games } = await syncSaturdaySlate(
    membership.league_id,
    getActiveSaturday()
  );

  const admin = createSupabaseAdminClient();
  const { data: leagueMemberships } = await admin
    .from("league_memberships")
    .select("id, display_name")
    .eq("league_id", membership.league_id)
    .order("display_name", { ascending: true });
  const picksPromise =
    games.length > 0
      ? admin
          .from("picks")
          .select("id, membership_id, game_id, picked_team, confidence")
          .in(
            "game_id",
            games.map((game) => game.id)
          )
      : Promise.resolve({ data: [], error: null });

  const [
    { data: picks },
    { data: weeklyEntries },
    { data: allWeeks },
    { data: historicalResults }
  ] = await Promise.all([
    picksPromise,
    admin
      .from("weekly_entries")
      .select("id, week_id, membership_id, tiebreak_total_runs")
      .eq("week_id", slate.id)
      .in(
        "membership_id",
        (leagueMemberships ?? []).map((row) => row.id).length > 0
          ? (leagueMemberships ?? []).map((row) => row.id)
          : ["00000000-0000-0000-0000-000000000000"]
      ),
    admin
      .from("weekly_slates")
      .select("id, league_id, saturday_date, status, tiebreak_game_id")
      .eq("league_id", membership.league_id),
    admin
      .from("historical_week_results")
      .select("id, league_id, week_number, membership_id, correct_picks, points, cash_delta, source_label")
      .eq("league_id", membership.league_id)
      .order("week_number", { ascending: true })
  ]);

  const now = Date.now();
  const allWeekIds = (allWeeks ?? []).map((week) => week.id);
  const [{ data: allGames }, { data: allPicks }, { data: allWeeklyEntries }] =
    await Promise.all([
      admin
        .from("games")
        .select("*")
        .in(
          "week_id",
          allWeekIds.length > 0
            ? allWeekIds
            : ["00000000-0000-0000-0000-000000000000"]
        ),
      admin
        .from("picks")
        .select("id, membership_id, game_id, picked_team, confidence"),
      admin
        .from("weekly_entries")
        .select("id, week_id, membership_id, tiebreak_total_runs")
    ]);
  const myWeeklyEntry =
    weeklyEntries?.find((entry) => entry.membership_id === membership.id) ?? null;

  const gamesWithPicks: GameWithPick[] = games.map((game) => ({
    ...game,
    pick:
      picks?.find(
        (pick) => pick.game_id === game.id && pick.membership_id === membership.id
      ) ?? null,
    locked: new Date(game.starts_at).getTime() <= now
  }));

  const completionStatus: PickCompletionStatus[] = (leagueMemberships ?? []).map(
    (row) => {
      const savedCount = new Set(
        (picks ?? [])
          .filter((pick) => pick.membership_id === row.id)
          .map((pick) => pick.game_id)
      ).size;
      const hasTiebreaker = Boolean(
        weeklyEntries?.find(
          (entry) =>
            entry.membership_id === row.id &&
            entry.tiebreak_total_runs !== null &&
            entry.tiebreak_total_runs !== undefined
        )
      );

      return {
        membershipId: row.id,
        displayName: row.display_name ?? "Unnamed player",
        savedCount,
        totalGames: games.length,
        hasTiebreaker
      };
    }
  );

  const standingsSnapshot = buildStandingsSnapshot({
    memberships: (leagueMemberships ?? []).map((row) => ({
      id: row.id,
      league_id: membership.league_id,
      user_id: "",
      display_name: row.display_name,
      import_label: null
    })),
    weeks: (allWeeks ?? []) as WeeklySlate[],
    games: (allGames ?? []) as Game[],
    picks: (allPicks ?? []) as Pick[],
    weeklyEntries: (allWeeklyEntries ?? []) as WeeklyEntry[],
    historicalResults: (historicalResults ?? []) as HistoricalWeekResult[]
  });

  const officialSeasonStandingByMembership = new Map(
    standingsSnapshot.seasonStandings.map((row) => [row.membershipId, row])
  );

  const currentWeekLeaderboard: CurrentWeekLeaderboardRow[] = (leagueMemberships ?? [])
    .map((row) => {
      const memberPicks = (picks ?? []).filter((pick) => pick.membership_id === row.id);
      const liveScores = memberPicks.reduce(
        (acc, pick) => {
          const game = games.find((item) => item.id === pick.game_id);
          const isCorrect = Boolean(game?.winner_team && game.winner_team === pick.picked_team);

          return {
            livePoints: acc.livePoints + (isCorrect ? pick.confidence : 0),
            liveCorrectPicks: acc.liveCorrectPicks + (isCorrect ? 1 : 0)
          };
        },
        { livePoints: 0, liveCorrectPicks: 0 }
      );
      const officialSeasonStanding = officialSeasonStandingByMembership.get(row.id);

      return {
        membershipId: row.id,
        displayName: row.display_name ?? "Unnamed player",
        livePoints: liveScores.livePoints,
        liveCorrectPicks: liveScores.liveCorrectPicks,
        seasonPoints: officialSeasonStanding?.seasonPoints ?? 0,
        seasonCorrectPicks: officialSeasonStanding?.seasonCorrectPicks ?? 0
      };
    })
    .sort((left, right) => {
      if (right.livePoints !== left.livePoints) {
        return right.livePoints - left.livePoints;
      }

      if (right.liveCorrectPicks !== left.liveCorrectPicks) {
        return right.liveCorrectPicks - left.liveCorrectPicks;
      }

      if (right.seasonPoints !== left.seasonPoints) {
        return right.seasonPoints - left.seasonPoints;
      }

      return left.displayName.localeCompare(right.displayName);
    });

  const livePickRevealGames: LivePickRevealGame[] = games.map((game) => ({
    gameId: game.id,
    awayTeam: game.away_team,
    homeTeam: game.home_team,
    startsAt: game.starts_at,
    status: game.status,
    locked: new Date(game.starts_at).getTime() <= now,
    winnerTeam: game.winner_team,
    reveals:
      new Date(game.starts_at).getTime() <= now
        ? (leagueMemberships ?? [])
            .map((row) => {
              const pick = (picks ?? []).find(
                (entry) => entry.membership_id === row.id && entry.game_id === game.id
              );

              if (!pick) {
                return null;
              }

              return {
                membershipId: row.id,
                displayName: row.display_name ?? "Unnamed player",
                pickedTeam: pick.picked_team,
                confidence: pick.confidence
              };
            })
            .filter((value): value is NonNullable<typeof value> => value !== null)
            .sort((left, right) => {
              if (right.confidence !== left.confidence) {
                return right.confidence - left.confidence;
              }

              return left.displayName.localeCompare(right.displayName);
            })
        : []
  }));

  return {
    membership,
    slate,
    games: gamesWithPicks,
    weeklyEntry: myWeeklyEntry,
    completionStatus,
    currentWeekLeaderboard,
    livePickRevealGames
  };
}

export async function getStandingsData() {
  const { membership } = await requireMembership();
  await syncSaturdaySlate(membership.league_id, getActiveSaturday());
  const admin = createSupabaseAdminClient();
  const { data: weeks } = await admin
    .from("weekly_slates")
    .select("id, league_id, saturday_date, status, tiebreak_game_id")
    .eq("league_id", membership.league_id)
    .order("saturday_date", { ascending: false });
  const weekIds = weeks?.map((week) => week.id) ?? [];
  const { data: memberships } = await admin
    .from("league_memberships")
    .select("id, league_id, user_id, display_name, import_label")
    .eq("league_id", membership.league_id)
    .order("display_name", { ascending: true });
  const { data: games } = await admin
    .from("games")
    .select("*")
    .in("week_id", weekIds.length > 0 ? weekIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: picks } = await admin
    .from("picks")
    .select("id, membership_id, game_id, picked_team, confidence");
  const { data: weeklyEntries } = await admin
    .from("weekly_entries")
    .select("id, week_id, membership_id, tiebreak_total_runs");
  const { data: historicalResults } = await admin
    .from("historical_week_results")
    .select("id, league_id, week_number, membership_id, correct_picks, points, cash_delta, source_label")
    .eq("league_id", membership.league_id)
    .order("week_number", { ascending: true });

  const weekList = (weeks ?? []) as WeeklySlate[];
  const membershipList = (memberships ?? []) as Membership[];
  const gameList = (games ?? []) as any[];
  const pickList = (picks ?? []) as any[];
  const entryList = (weeklyEntries ?? []) as any[];
  const historicalList = (historicalResults ?? []) as HistoricalWeekResult[];

  const snapshot = buildStandingsSnapshot({
    memberships: membershipList,
    weeks: weekList,
    games: gameList,
    picks: pickList,
    weeklyEntries: entryList,
    historicalResults: historicalList
  });

  return {
    bestWeekScores: snapshot.bestWeekScores,
    seasonStandings: snapshot.seasonStandings,
    weeklyStandings: snapshot.weeklyStandings,
    weekNumbers: snapshot.weekNumbers
  };
}

export async function getHistoricalImportData() {
  const { membership } = await requireMembership();
  const admin = createSupabaseAdminClient();
  const { data: memberships } = await admin
    .from("league_memberships")
    .select("id, league_id, user_id, display_name, import_label")
    .eq("league_id", membership.league_id)
    .order("display_name", { ascending: true });
  const { data: historicalResults } = await admin
    .from("historical_week_results")
    .select("id, league_id, week_number, membership_id, correct_picks, points, cash_delta, source_label")
    .eq("league_id", membership.league_id)
    .order("week_number", { ascending: true });

  return {
    membership,
    memberships: (memberships ?? []) as Membership[],
    historicalResults: (historicalResults ?? []) as HistoricalWeekResult[]
  };
}
