import Link from "next/link";
import { requestEmailCodeAction, verifyEmailCodeAction } from "@/app/actions";
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
  const email = params.email ?? "";

  return (
    <div className="page-grid">
      <section className="section-card">
        <span className="eyebrow">Email login</span>
        <h2>Enter the pool with an email code</h2>
        <p>
          Use the same email address your league expects. We&apos;ll send a one-time
          code to your inbox so you can finish sign-in in this same browser.
        </p>
        <form action={requestEmailCodeAction} className="form-grid">
          <label className="field">
            Email address
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              defaultValue={email}
              required
            />
          </label>
          <input type="hidden" name="next" value={next} />
          <SubmitButton label="Send email code" pendingLabel="Sending..." />
        </form>
        {params.sent ? (
          <>
            <p>
              Code sent to <strong>{params.email}</strong>. Enter the newest 6-digit
              code below.
            </p>
            <form action={verifyEmailCodeAction} className="form-grid">
              <label className="field">
                6-digit code
                <input
                  type="text"
                  name="token"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  placeholder="123456"
                  required
                />
              </label>
              <input type="hidden" name="email" value={params.email ?? ""} />
              <input type="hidden" name="next" value={next} />
              <SubmitButton label="Verify code" pendingLabel="Verifying..." />
            </form>
          </>
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
