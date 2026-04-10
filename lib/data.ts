import "server-only";

import { redirect } from "next/navigation";
import { getActiveSaturday } from "@/lib/dates";
import { syncSaturdaySlate } from "@/lib/mlb";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildSeasonStandings, buildWeeklyStandingsForWeek } from "@/lib/scoring";
import type { GameWithPick, Membership, WeeklySlate } from "@/lib/types";

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
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("league_memberships")
    .select("id, league_id, user_id, display_name")
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

  const supabase = await createSupabaseServerClient();
  const picksPromise =
    games.length > 0
      ? supabase
          .from("picks")
          .select("id, membership_id, game_id, picked_team, confidence")
          .eq("membership_id", membership.id)
          .in(
            "game_id",
            games.map((game) => game.id)
          )
      : Promise.resolve({ data: [], error: null });

  const [{ data: picks }, { data: weeklyEntry }] = await Promise.all([
    picksPromise,
    supabase
      .from("weekly_entries")
      .select("id, week_id, membership_id, tiebreak_total_runs")
      .eq("membership_id", membership.id)
      .eq("week_id", slate.id)
      .maybeSingle()
  ]);

  const now = Date.now();

  const gamesWithPicks: GameWithPick[] = games.map((game) => ({
    ...game,
    pick: picks?.find((pick) => pick.game_id === game.id) ?? null,
    locked: new Date(game.starts_at).getTime() <= now
  }));

  return {
    membership,
    slate,
    games: gamesWithPicks,
    weeklyEntry
  };
}

export async function getStandingsData() {
  const { membership } = await requireMembership();
  await syncSaturdaySlate(membership.league_id, getActiveSaturday());
  const supabase = await createSupabaseServerClient();
  const { data: weeks } = await supabase
    .from("weekly_slates")
    .select("id, league_id, saturday_date, status, tiebreak_game_id")
    .eq("league_id", membership.league_id)
    .order("saturday_date", { ascending: false });
  const weekIds = weeks?.map((week) => week.id) ?? [];
  const { data: memberships } = await supabase
    .from("league_memberships")
    .select("id, league_id, user_id, display_name")
    .eq("league_id", membership.league_id)
    .order("display_name", { ascending: true });
  const { data: games } = await supabase
    .from("games")
    .select("*")
    .in("week_id", weekIds.length > 0 ? weekIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: picks } = await supabase
    .from("picks")
    .select("id, membership_id, game_id, picked_team, confidence");
  const { data: weeklyEntries } = await supabase
    .from("weekly_entries")
    .select("id, week_id, membership_id, tiebreak_total_runs");

  const weekList = (weeks ?? []) as WeeklySlate[];
  const membershipList = (memberships ?? []) as Membership[];
  const gameList = (games ?? []) as any[];
  const pickList = (picks ?? []) as any[];
  const entryList = (weeklyEntries ?? []) as any[];

  const seasonStandings = buildSeasonStandings({
    memberships: membershipList,
    weeks: weekList,
    games: gameList,
    picks: pickList,
    weeklyEntries: entryList
  });

  const weeklyStandings = weekList.map((week) => ({
    week,
    standings: buildWeeklyStandingsForWeek(
      week,
      membershipList,
      gameList,
      pickList,
      entryList
    )
  }));

  return {
    seasonStandings,
    weeklyStandings
  };
}
