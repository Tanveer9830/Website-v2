import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/security";
import "./globals.css";
export const metadata: Metadata = {
  title: "TOP CLOUD — Staff applications",
  description:
    "Find your role at TOP CLOUD. Explore staff opportunities and apply securely.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link className="brand" href="/">
            <span className="brand-icon">TC</span>
            <span>
              TOP <b>CLOUD</b>
              <small>STAFF PORTAL</small>
            </span>
          </Link>
          <nav className="nav">
            <Link href="/#roles">Open roles</Link>
            <Link href="/#about">About</Link>
            {user ? (
              <>
                {user.role === "SUPER_OWNER" ? (
                  <>
                    <Link href="/admin/owner">Owner panel</Link>
                    <Link href="/admin">Admin panel</Link>
                  </>
                ) : user.role === "ADMIN" || user.role === "REVIEWER" ? (
                  <Link href="/admin">Admin panel</Link>
                ) : (
                  <Link href="/dashboard">My dashboard</Link>
                )}
                <span className="nav-user">{user.username}</span>
                <form action="/api/auth/logout" method="post">
                  <button className="nav-link">Sign out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">Sign in</Link>
                <Link className="button button-small" href="/register">
                  Create account
                </Link>
              </>
            )}
          </nav>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <div className="footer-inner">
            <Link className="brand" href="/">
              <span className="brand-icon">TC</span>
              <span>
                TOP <b>CLOUD</b>
                <small>STAFF PORTAL</small>
              </span>
            </Link>
            <p>Build something dependable. Grow with TOP CLOUD.</p>
            <div className="footer-links">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <a
                href={`mailto:${process.env.SUPPORT_EMAIL || "support@topcloud.example"}`}
              >
                Support
              </a>
            </div>
            <p className="credits">Made by Tanveer | Discord: tanveer5637</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
