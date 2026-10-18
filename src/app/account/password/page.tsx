import { redirect } from "next/navigation";
import { currentUser } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function ChangePassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const q = await searchParams;
  return (
    <section className="auth-shell single-auth">
      <div className="auth-card">
        <div className="section-kicker">ACCOUNT SECURITY</div>
        <h2>Change your password</h2>
        <p>
          {user.mustChangePassword
            ? "Your staff account requires a password update before continuing."
            : "Choose a new password. Other active sessions will be revoked."}
        </p>
        {q.error && (
          <div className="flash error">
            Current password may be incorrect, or the new password did not meet
            the requirements.
          </div>
        )}
        <form action="/api/auth/password" method="post" className="form-stack">
          <label>
            Current password
            <input
              type="password"
              name="current_password"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              name="new_password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
          <button className="button button-wide">Update password</button>
        </form>
      </div>
    </section>
  );
}
