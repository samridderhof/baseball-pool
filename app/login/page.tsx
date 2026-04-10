import Link from "next/link";
import { requestMagicLinkAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    sent?: string;
    email?: string;
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = params.next ?? "/dashboard";

  return (
    <div className="page-grid">
      <section className="section-card">
        <span className="eyebrow">Email login</span>
        <h2>Enter the pool with a magic link</h2>
        <p>
          Use the same email address your league expects. After login, open your
          invite link to join the pool.
        </p>
        <form action={requestMagicLinkAction} className="form-grid">
          <label className="field">
            Email address
            <input type="email" name="email" placeholder="you@example.com" required />
          </label>
          <input type="hidden" name="next" value={next} />
          <SubmitButton label="Send magic link" pendingLabel="Sending..." />
        </form>
        {params.sent ? (
          <p>
            Magic link sent to <strong>{params.email}</strong>. Check your inbox and
            open it on this device.
          </p>
        ) : null}
        {params.error ? <p>{params.error}</p> : null}
        <p className="muted">
          Need to join a league after signing in? Use the invite URL your
          commissioner shared.
        </p>
        <Link href="/" className="muted">
          Back home
        </Link>
      </section>
    </div>
  );
}
