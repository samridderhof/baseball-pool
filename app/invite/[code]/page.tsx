import Link from "next/link";
import { joinLeagueAction } from "@/app/actions";
import { getCurrentUser, getLeagueByInviteCode, getMembershipForUser } from "@/lib/data";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const user = await getCurrentUser();
  const league = await getLeagueByInviteCode(code);

  if (!league) {
    return (
      <div className="page-grid">
        <section className="section-card">
          <h2>Invite not found</h2>
          <p>This league link is invalid or expired.</p>
        </section>
      </div>
    );
  }

  const membership = user ? await getMembershipForUser(user.id) : null;

  return (
    <div className="page-grid">
      <section className="hero">
        <span className="eyebrow">League invite</span>
        <h1>{league.name}</h1>
        <p>
          You are joining the {league.season_year} Saturday Slugfest season. One
          invite, one league, all season long.
        </p>
      </section>

      {!user ? (
        <section className="section-card">
          <h2>Sign in to accept this invite</h2>
          <p>Login first, then come right back here to finish joining.</p>
          <Link href={`/login?next=/invite/${code}`} className="btn">
            Sign in
          </Link>
        </section>
      ) : membership?.league_id === league.id ? (
        <section className="section-card">
          <h2>You are already in this league</h2>
          <Link href="/dashboard" className="btn">
            Go to dashboard
          </Link>
        </section>
      ) : membership ? (
        <section className="section-card">
          <h2>This account is already tied to another league</h2>
          <p>v1 keeps each user in exactly one private league.</p>
        </section>
      ) : (
        <section className="section-card">
          <h2>Claim your roster spot</h2>
          <form action={joinLeagueAction} className="form-grid">
            <label className="field">
              Display name
              <input
                type="text"
                name="displayName"
                placeholder="Your name for standings"
                minLength={2}
                maxLength={40}
                required
              />
            </label>
            <input type="hidden" name="inviteCode" value={code} />
            <SubmitButton label="Join league" />
          </form>
        </section>
      )}
    </div>
  );
}
