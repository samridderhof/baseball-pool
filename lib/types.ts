export type League = {
  id: string;
  name: string;
  invite_code: string;
  season_year: number;
};

export type Membership = {
  id: string;
  league_id: string;
  user_id: string;
  display_name: string | null;
};

export type WeeklySlate = {
  id: string;
  league_id: string;
  saturday_date: string;
  status: "upcoming" | "live" | "final";
  tiebreak_game_id: string | null;
};

export type Game = {
  id: string;
  external_id: number;
  week_id: string;
  starts_at: string;
  away_team: string;
  home_team: string;
  away_score: number | null;
  home_score: number | null;
  status: string;
  winner_team: string | null;
  sort_order: number;
};

export type Pick = {
  id: string;
  membership_id: string;
  game_id: string;
  picked_team: string;
  confidence: number;
};

export type WeeklyEntry = {
  id: string;
  week_id: string;
  membership_id: string;
  tiebreak_total_runs: number | null;
};

export type GameWithPick = Game & {
  pick: Pick | null;
  locked: boolean;
};

export type WeeklyStanding = {
  membershipId: string;
  displayName: string;
  points: number;
  correctPicks: number;
  tiebreakPrediction: number | null;
  tiebreakDiff: number | null;
  isWinner: boolean;
};

export type SeasonStanding = {
  membershipId: string;
  displayName: string;
  seasonPoints: number;
  weeklyWins: number;
};
