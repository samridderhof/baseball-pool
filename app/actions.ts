"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireMembership, requireUser } from "@/lib/data";
import { env } from "@/lib/env";

const loginSchema = z.object({
  email: z.string().email(),
  next: z.string().optional()
});

const joinSchema = z.object({
  inviteCode: z.string().min(4),
  displayName: z.string().min(2).max(40)
});

function cleanNextPath(nextPath: string | undefined) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/dashboard";
  }

  return nextPath;
}

export async function requestMagicLinkAction(formData: FormData) {
  const parsed = loginSchema.parse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined
  });

  const supabase = await createSupabaseServerClient();
  const callbackUrl = new URL("/auth/callback", env.siteUrl);
  callbackUrl.searchParams.set("next", cleanNextPath(parsed.next));

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.email,
    options: {
      emailRedirectTo: callbackUrl.toString()
    }
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/login?sent=1&email=${encodeURIComponent(parsed.email)}`);
}

export async function joinLeagueAction(formData: FormData) {
  const user = await requireUser();
  const parsed = joinSchema.parse({
    inviteCode: formData.get("inviteCode"),
    displayName: formData.get("displayName")
  });

  const supabase = await createSupabaseServerClient();
  const { data: existingMembership } = await supabase
    .from("league_memberships")
    .select("id, league_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: league } = await supabase
    .from("leagues")
    .select("id")
    .eq("invite_code", parsed.inviteCode)
    .maybeSingle();

  if (!league) {
    redirect("/?error=invite-not-found");
  }

  if (existingMembership && existingMembership.league_id !== league.id) {
    redirect("/?error=already-in-league");
  }

  const { error } = await supabase.from("league_memberships").upsert(
    {
      user_id: user.id,
      league_id: league.id,
      display_name: parsed.displayName
    },
    {
      onConflict: "user_id"
    }
  );

  if (error) {
    redirect(`/?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function savePicksAction(formData: FormData) {
  const { membership } = await requireMembership();
  const weekId = z.string().uuid().parse(formData.get("weekId"));
  const tiebreakValue = z.coerce.number().int().min(0).max(99).parse(formData.get("tiebreak"));
  const supabase = await createSupabaseServerClient();

  const [{ data: slate }, { data: games }, { data: currentPicks }] = await Promise.all([
    supabase
      .from("weekly_slates")
      .select("id, league_id")
      .eq("id", weekId)
      .eq("league_id", membership.league_id)
      .single(),
    supabase
      .from("games")
      .select("id, starts_at, away_team, home_team")
      .eq("week_id", weekId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("picks")
      .select("id, membership_id, game_id, picked_team, confidence")
      .eq("membership_id", membership.id)
  ]);

  if (!slate || !games) {
    redirect("/picks?error=missing-week");
  }

  const now = Date.now();
  const gameIds = games.map((game) => game.id);
  const submitted = games.map((game) => ({
      gameId: game.id,
      pickedTeam: formData.get(`pick:${game.id}`)?.toString() ?? "",
      confidenceRaw: formData.get(`confidence:${game.id}`)?.toString() ?? "",
      locked: new Date(game.starts_at).getTime() <= now
    }));

  const hasPartialSubmission = submitted.some(
    (pick) =>
      !pick.locked &&
      ((pick.pickedTeam && !pick.confidenceRaw) ||
        (!pick.pickedTeam && pick.confidenceRaw))
  );

  if (hasPartialSubmission) {
    redirect("/picks?error=confidence");
  }

  const parsedSubmitted = submitted
    .filter((pick) => !pick.locked && pick.pickedTeam && pick.confidenceRaw)
    .map((pick) => ({
      game_id: pick.gameId,
      membership_id: membership.id,
      picked_team: pick.pickedTeam,
      confidence: Number(pick.confidenceRaw)
    }));

  const finalPickMap = new Map<string, { picked_team: string; confidence: number }>();

  currentPicks
    ?.filter((pick) => gameIds.includes(pick.game_id))
    .forEach((pick) => {
      finalPickMap.set(pick.game_id, {
        picked_team: pick.picked_team,
        confidence: pick.confidence
      });
    });

  parsedSubmitted.forEach((pick) => {
    finalPickMap.set(pick.game_id, {
      picked_team: pick.picked_team,
      confidence: pick.confidence
    });
  });

  const confidences = [...finalPickMap.values()].map((pick) => pick.confidence);
  const hasInvalidConfidence = confidences.some(
    (confidence) =>
      Number.isNaN(confidence) || confidence < 1 || confidence > games.length
  );
  const hasInvalidTeam = parsedSubmitted.some((pick) => {
    const game = games.find((item) => item.id === pick.game_id);
    return !game || ![game.away_team, game.home_team].includes(pick.picked_team);
  });
  const hasDuplicates = new Set(confidences).size !== confidences.length;

  if (hasInvalidConfidence || hasDuplicates || hasInvalidTeam) {
    redirect("/picks?error=confidence");
  }

  if (parsedSubmitted.length > 0) {
    const { error } = await supabase.from("picks").upsert(parsedSubmitted, {
      onConflict: "membership_id,game_id"
    });

    if (error) {
      redirect(`/picks?error=${encodeURIComponent(error.message)}`);
    }
  }

  const { error: weeklyEntryError } = await supabase.from("weekly_entries").upsert(
    {
      membership_id: membership.id,
      week_id: weekId,
      tiebreak_total_runs: tiebreakValue
    },
    {
      onConflict: "membership_id,week_id"
    }
  );

  if (weeklyEntryError) {
    redirect(`/picks?error=${encodeURIComponent(weeklyEntryError.message)}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/picks");
  revalidatePath("/standings");
  redirect("/picks?saved=1");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
