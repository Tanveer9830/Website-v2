import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { appUser, hasPermission } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function Applicants({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await appUser();
  if (
    !["SUPER_OWNER", "ADMIN"].includes(user.role) ||
    !hasPermission(user, "applicants.manage")
  )
    redirect("/forbidden");
  const q = await searchParams;
  const search = (q.q || "").trim().slice(0, 100),
    page = Math.max(1, Number(q.page) || 1),
    filter = search
      ? and(
          eq(users.role, "APPLICANT"),
          or(
            ilike(users.username, `%${search}%`),
            ilike(users.email, `%${search}%`),
          ),
        )
      : eq(users.role, "APPLICANT");
  const rows = await db
    .select()
    .from(users)
    .where(filter)
    .orderBy(desc(users.createdAt))
    .limit(30)
    .offset((page - 1) * 30);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(filter);
  const pages = Math.max(1, Math.ceil(Number(count) / 30));
  return (
    <section className="page-wrap">
      <div className="panel-head">
        <aside className="sidebar">
          <Link className="side-logo" href="/">
            <span className="brand-icon">TC</span>
            <span>
              TOP CLOUD<small>STAFF PORTAL</small>
            </span>
          </Link>
          <div className="side-label">WORKSPACE</div>
          <Link className="side-link" href="/admin">
            ▦ &nbsp; Application queue
          </Link>
          <Link className="side-link active" href="/admin/applicants">
            ♙ &nbsp; Applicants
          </Link>
          {user.role === "SUPER_OWNER" && (
            <Link className="side-link" href="/admin/owner">
              ◇ &nbsp; Owner panel
            </Link>
          )}
          <Link className="side-link" href="/">
            ↗ &nbsp; Public website
          </Link>
        </aside>
        <div className="panel-content">
          <div className="section-kicker">ACCOUNT MANAGEMENT</div>
          <h1>Applicants.</h1>
          <p>
            Applicant account directory. Application answers remain available in
            each authorized review.
          </p>
          <form method="get" className="filter-bar">
            <input
              name="q"
              placeholder="Search username or email"
              defaultValue={search}
            />
            <button className="button button-small">Search</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>USERNAME</th>
                  <th>EMAIL</th>
                  <th>STATUS</th>
                  <th>JOINED</th>
                  <th>APPLICATIONS</th>
                  <th>ACCESS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <b>{u.username}</b>
                    </td>
                    <td>{u.email}</td>
                    <td>{u.status}</td>
                    <td>
                      {u.createdAt.toLocaleDateString("en", {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      })}
                    </td>
                    <td>
                      <Link href={`/admin?q=${encodeURIComponent(u.username)}`}>
                        View in queue →
                      </Link>
                    </td>
                    <td>
                      <form
                        method="post"
                        action={`/api/owner/applicants/${u.id}`}
                      >
                        <input
                          type="hidden"
                          name="action"
                          value={u.status === "ACTIVE" ? "disable" : "enable"}
                        />
                        <button className="table-link">
                          {u.status === "ACTIVE" ? "Disable" : "Enable"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      No applicants found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <Link
              href={`?page=${Math.max(1, page - 1)}&q=${encodeURIComponent(search)}`}
            >
              ← Previous
            </Link>
            <span>
              Page {page} of {pages} · {count} applicants
            </span>
            <Link
              href={`?page=${Math.min(pages, page + 1)}&q=${encodeURIComponent(search)}`}
            >
              Next →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
