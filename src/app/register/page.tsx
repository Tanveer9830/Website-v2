import Link from "next/link";
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const q = await searchParams;
  return (
    <section className="auth-shell">
      <div className="auth-aside">
        <div className="section-kicker">TOP CLOUD · STAFF RECRUITMENT</div>
        <h1>A new chapter starts here.</h1>
        <p>
          Create an applicant account to explore open roles, submit
          applications, and hear from our team.
        </p>
        <div className="auth-note">
          <span className="brand-icon">TC</span>People make the cloud.
        </div>
      </div>
      <div className="auth-card">
        <Link className="back-link" href="/">
          ← Back to TOP CLOUD
        </Link>
        <h2>Create your account</h2>
        <p>Applicant accounts are for recruitment only.</p>
        {q.error && (
          <div className="flash error">
            {q.error === "duplicate"
              ? "That username or email is already registered."
              : q.error === "slow-down"
                ? "Too many registration attempts. Try again later."
                : "Check your details. Passwords must be at least 12 characters."}
          </div>
        )}
        <form action="/api/auth/register" method="post" className="form-stack">
          <label>
            Username
            <input
              name="username"
              autoComplete="username"
              minLength={3}
              maxLength={40}
              pattern="[A-Za-z0-9_]+"
              required
              placeholder="Your username"
            />
          </label>
          <label>
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              maxLength={254}
              required
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              placeholder="At least 12 characters"
            />
          </label>
          <button className="button button-wide">
            Create account <span>↗</span>
          </button>
        </form>
        <div className="auth-switch">
          Already registered? <Link href="/login">Sign in</Link>
        </div>
        <div className="secure-note">
          Your password is never stored in plaintext.
        </div>
      </div>
    </section>
  );
}
