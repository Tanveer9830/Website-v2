import Link from "next/link";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const q = await searchParams;
  return (
    <section className="auth-shell">
      <div className="auth-aside">
        <div className="section-kicker">TOP CLOUD · STAFF RECRUITMENT</div>
        <h1>Welcome back to your next chapter.</h1>
        <p>
          Securely manage your staff application and stay in touch with our
          team.
        </p>
        <div className="auth-note">
          <span className="brand-icon">TC</span>People make the cloud.
        </div>
      </div>
      <div className="auth-card">
        <Link className="back-link" href="/">
          ← Back to TOP CLOUD
        </Link>
        <h2>Sign in</h2>
        <p>Use your account credentials to continue.</p>
        {q.created && (
          <div className="flash success">
            Account created. Sign in to continue.
          </div>
        )}
        {q.error && (
          <div className="flash error">
            {q.error === "slow-down"
              ? "Too many attempts. Please wait a few minutes."
              : q.error === "csrf"
                ? "Please use the sign-in form on this website."
                : "Unable to sign in with those details."}
          </div>
        )}
        <form action="/api/auth/login" method="post" className="form-stack">
          <label>
            Username or email
            <input
              name="account"
              autoComplete="username"
              required
              autoFocus
              placeholder="Username or email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="Your password"
            />
          </label>
          <button className="button button-wide">
            Sign in <span>↗</span>
          </button>
        </form>
        <div className="auth-switch">
          New to TOP CLOUD? <Link href="/register">Create an account</Link>
        </div>
        <div className="secure-note">
          Secure sessions and Argon2id password storage.
        </div>
      </div>
    </section>
  );
}
