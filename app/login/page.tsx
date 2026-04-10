import Link from "next/link";
import {
  requestPasswordResetAction,
  signInWithPasswordAction,
  signUpWithPasswordAction
} from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    created?: string;
    email?: string;
    error?: string;
    next?: string;
    reset?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = params.next ?? "/dashboard";
  const email = params.email ?? "";

  return (
    <div className="page-grid">
      <section className="section-card">
        <span className="eyebrow">Login</span>
        <h2>Sign in with email and password</h2>
        <p>
          This is the easiest way to make weekly Saturday logins reliable without
          depending on one-time email sends.
        </p>
        <form action={signInWithPasswordAction} className="form-grid">
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
          <label className="field">
            Password
            <input
              type="password"
              name="password"
              minLength={8}
              placeholder="Enter your password"
              required
            />
          </label>
          <input type="hidden" name="next" value={next} />
          <SubmitButton label="Sign in" pendingLabel="Signing in..." />
        </form>
        {params.error ? <p>{params.error}</p> : null}
        {params.reset ? (
          <p>
            Password reset email sent to <strong>{params.email}</strong>. Open the
            newest email and follow the link to set your password.
          </p>
        ) : null}
      </section>

      <section className="section-card">
        <span className="eyebrow">First time here?</span>
        <h2>Create your account</h2>
        <p>
          New league members can create an account with email and password, then use the
          invite link to join the pool.
        </p>
        <form action={signUpWithPasswordAction} className="form-grid">
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
          <label className="field">
            Password
            <input
              type="password"
              name="password"
              minLength={8}
              placeholder="Create a password"
              required
            />
          </label>
          <input type="hidden" name="next" value={next} />
          <SubmitButton label="Create account" pendingLabel="Creating..." />
        </form>
        {params.created ? (
          <p>
            Account created for <strong>{params.email}</strong>. Check your email if
            Supabase asks you to confirm the address, then sign in above.
          </p>
        ) : null}
        <p className="muted">
          Need to join a league after signing in? Use the invite URL your
          commissioner shared.
        </p>
        <Link href="/" className="muted">
          Back home
        </Link>
      </section>

      <section className="section-card">
        <span className="eyebrow">Already have an account?</span>
        <h2>Set or reset your password</h2>
        <p>
          Existing members who signed up before password login can send themselves
          a password reset email, then create a password once.
        </p>
        <form action={requestPasswordResetAction} className="form-grid">
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
          <SubmitButton label="Email me a reset link" pendingLabel="Sending..." />
        </form>
      </section>
    </div>
  );
}
