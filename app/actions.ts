"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireMembership, requireUser } from "@/lib/data";
import { env } from "@/lib/env";

const loginSchema = z.object({
  email: z.string().email(),
  next: z.string().optional()
});

const verifyCodeSchema = z.object({
  email: z.string().email(),
  token: z.string().trim().min(6).max(6),
  next: z.string().optional()
});

const joinSchema = z.object({
  inviteCode: z.string().min(4),
  displayName: z.string().min(2).max(40)
});

const importRowSchema = z.object({
  week: z.coerce.number().int().positive(),
  player: z.string().min(1),
  correct_picks: z.coerce.number().int().min(0).nullable(),
  points: z.coerce.number().int(),
  cash_delta: z.coerce.number().int()
});

function normalizeImportKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseHistoricalCsv(csvText: string) {
  const rows = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length < 2) {
    throw new Error("Add a header row and at least one historical result row.");
  }

  const header = rows[0].split(",").map((column) => column.trim().toLowerCase());
  const expected = ["week", "player", "correct_picks", "points", "cash_delta"];

  if (expected.some((column, index) => header[index] !== column)) {
    throw new Error("CSV must start with: week,player,correct_picks,points,cash_delta");
  }

  return rows.slice(1).map((line) => {
    const columns = line.split(",").map((column) => column.trim());

    return importRowSchema.parse({
      week: columns[0],
      player: columns[1],
      correct_picks: columns[2] === "" ? null : columns[2],
      points: columns[3],
      cash_delta: columns[4]
    });
  });
}

function cleanNextPath(nextPath: string | undefined) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/dashboard";
  }

  return nextPath;
}

export async function requestEmailCodeAction(formData: FormData) {
  const parsed = loginSchema.parse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined
  });

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.email,
    options: {
      shouldCreateUser: true
    }
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(
    `/login?sent=1&email=${encodeURIComponent(parsed.email)}&next=${encodeURIComponent(
      cleanNextPath(parsed.next)
    )}`
  );
}

export async function verifyEmailCodeAction(formData: FormData) {
  const parsed = verifyCodeSchema.parse({
    email: formData.get("email"),
    token: formData.get("token"),
    next: formData.get("next") ?? undefined
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.email,
    token: parsed.token,
    type: "email"
  });

  if (error) {
    redirect(
      `/login?sent=1&email=${encodeURIComponent(parsed.email)}&next=${encodeURIComponent(
        cleanNextPath(parsed.next)
      )}&error=${encodeURIComponent(error.message)}`
    );
  }

  redirect(cleanNextPath(parsed.next));
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
  const admin = createSupabaseAdminClient();

  const [{ data: slate }, { data: games }, { data: currentPicks }] = await Promise.all([
    admin
      .from("weekly_slates")
      .select("id, league_id")
      .eq("id", weekId)
      .eq("league_id", membership.league_id)
      .single(),
    admin
      .from("games")
      .select("id, starts_at, away_team, home_team")
      .eq("week_id", weekId)
      .order("sort_order", { ascending: true }),
    admin
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
    const { error } = await admin.from("picks").upsert(parsedSubmitted, {
      onConflict: "membership_id,game_id"
    });

    if (error) {
      redirect(`/picks?error=${encodeURIComponent(error.message)}`);
    }
  }

  const { error: weeklyEntryError } = await admin.from("weekly_entries").upsert(
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

export async function saveImportLabelsAction(formData: FormData) {
  const { membership } = await requireMembership();
  const admin = createSupabaseAdminClient();
  const { data: memberships } = await admin
    .from("league_memberships")
    .select("id")
    .eq("league_id", membership.league_id);

  for (const row of memberships ?? []) {
    const importLabel = formData.get(`importLabel:${row.id}`)?.toString().trim() ?? "";

    await admin
      .from("league_memberships")
      .update({
        import_label: importLabel.length > 0 ? importLabel : null
      })
      .eq("id", row.id)
      .eq("league_id", membership.league_id);
  }

  revalidatePath("/history-import");
  revalidatePath("/standings");
  redirect("/history-import?saved=labels");
}

export async function importHistoricalResultsAction(formData: FormData) {
  try {
    const { membership } = await requireMembership();
    const csvText = formData.get("historicalCsv")?.toString() ?? "";
    const rows = parseHistoricalCsv(csvText);
    const admin = createSupabaseAdminClient();
    const { data: memberships } = await admin
      .from("league_memberships")
      .select("id, display_name, import_label")
      .eq("league_id", membership.league_id);

    const membershipMap = new Map<string, string>();

    (memberships ?? []).forEach((row) => {
      if (row.display_name) {
        membershipMap.set(normalizeImportKey(row.display_name), row.id);
      }
      if (row.import_label) {
        membershipMap.set(normalizeImportKey(row.import_label), row.id);
      }
    });

    const payload = rows.map((row) => {
      const membershipId = membershipMap.get(normalizeImportKey(row.player));

      if (!membershipId) {
        throw new Error(
          `No league member matches "${row.player}". Add or update an import label first.`
        );
      }

      return {
        league_id: membership.league_id,
        week_number: row.week,
        membership_id: membershipId,
        correct_picks: row.correct_picks,
        points: row.points,
        cash_delta: row.cash_delta,
        source_label: row.player
      };
    });

    const { error } = await admin.from("historical_week_results").upsert(payload, {
      onConflict: "league_id,week_number,membership_id"
    });

    if (error) {
      redirect(`/history-import?error=${encodeURIComponent(error.message)}`);
    }

    revalidatePath("/history-import");
    revalidatePath("/standings");
    redirect(`/history-import?saved=history&rows=${payload.length}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Historical import failed.";
    redirect(`/history-import?error=${encodeURIComponent(message)}`);
  }
}
