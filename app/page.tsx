import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthDebugState, getCurrentUser, getMembershipForUser } from "@/lib/data";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  "invite-not-found": "That invite link was not found.",
  "already-in-league": "This account has already joined a different league."
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const authDebug = await getAuthDebugState();
  const headerStore = await headers();
  const host = headerStore.get("host");

  if (user) {
    const membership = await getMembershipForUser(user.id);

    if (membership) {
      redirect("/dashboard");
    }
  }

  return (
    <div className="page-grid">
      <section className="hero">
        <span className="eyebrow">Private MLB confidence pool</span>
        <h1>The Baseball Pool</h1>
        <p>
          &ldquo;Every strike brings me closer to the next home run.&rdquo; - Babe
          Ruth
        </p>
        <p>
          A private weekly MLB pool built for sharp picks, confidence points,
          tiebreak drama, and a full season of standings.
        </p>
        <div className="cta-row">
          <Link href="/login" className="btn">
            Sign in with email
          </Link>
          <Link href="/standings" className="btn-secondary">
            View format
          </Link>
        </div>
      </section>

      {params.error ? (
        <section className="section-card">
          <strong>{errorMessages[params.error] ?? "Something went wrong."}</strong>
        </section>
      ) : null}

      <section className="section-card">
        <h2>Debug status</h2>
        <div className="info-grid">
          <div className="info-card">
            <strong>Host</strong>
            <span className="muted">{host ?? "unknown"}</span>
          </div>
          <div className="info-card">
            <strong>User</strong>
            <span className="muted">
              {authDebug.user?.email ?? "No authenticated user"}
            </span>
          </div>
          <div className="info-card">
            <strong>Membership</strong>
            <span className="muted">
              {authDebug.membership
                ? `${authDebug.membership.display_name} (${authDebug.membership.id})`
                : "No membership found"}
            </span>
          </div>
        </div>
      </section>

      <section className="section-card">
        <h2>How v1 works</h2>
        <div className="stat-grid">
          <div className="stat">
            Saturday slate
            <strong>Weekly</strong>
            <span className="muted">
              Pick the winners for every MLB game on Saturday.
            </span>
          </div>
          <div className="stat">
            Confidence scoring
            <strong>1 to N</strong>
            <span className="muted">
              Rank every game by confidence and cash in when you are right.
            </span>
          </div>
          <div className="stat">
            Season standings
            <strong>All year</strong>
            <span className="muted">
              Weekly winners and season totals stay on the board all season long.
            </span>
          </div>
        </div>
      </section>

      <section className="section-card">
        <h2>Clubhouse wall</h2>
        <p>
          A few of the game&apos;s biggest stars, right where they belong.
        </p>
        <div className="player-grid">
          <article className="player-tile">
            <Image
              src="/players/shohei.png"
              alt="Shohei Ohtani"
              fill
              sizes="(max-width: 720px) 100vw, 33vw"
              className="player-photo"
            />
          </article>
          <article className="player-tile">
            <Image
              src="/players/acuna.png"
              alt="Ronald Acuna Jr."
              fill
              sizes="(max-width: 720px) 100vw, 33vw"
              className="player-photo"
            />
          </article>
          <article className="player-tile">
            <Image
              src="/players/judge.png"
              alt="Aaron Judge"
              fill
              sizes="(max-width: 720px) 100vw, 33vw"
              className="player-photo"
            />
          </article>
        </div>
      </section>
    </div>
  );
}
