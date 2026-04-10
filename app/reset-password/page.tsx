import { updatePasswordAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ResetPasswordPage({
  searchParams
}: ResetPasswordPageProps) {
  const params = await searchParams;

  return (
    <div className="page-grid">
      <section className="section-card">
        <span className="eyebrow">Password reset</span>
        <h2>Create your new password</h2>
        <p>
          Set a password once here, then use email and password for your normal
          Saturday logins.
        </p>
        <form action={updatePasswordAction} className="form-grid">
          <label className="field">
            New password
            <input
              type="password"
              name="password"
              minLength={8}
              placeholder="At least 8 characters"
              required
            />
          </label>
          <input type="hidden" name="next" value="/dashboard" />
          <SubmitButton label="Save new password" pendingLabel="Saving..." />
        </form>
        {params.error ? <p>{params.error}</p> : null}
      </section>
    </div>
  );
}
