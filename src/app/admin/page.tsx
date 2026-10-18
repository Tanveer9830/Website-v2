import Link from "next/link";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { applications, positions, users } from "@/lib/schema";
import { appUser, hasPermission } from "@/lib/security";
export const dynamic = "force-dynamic";
const statuses = [
  "PENDING",
  "REVIEWING",
  "UNDER_CONSIDERATION",
  "APPROVED",
  "REJECTED",
  "ON_HOLD",
] as const;
const pretty = (v: string) =>
  v
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    position?: string;
    page?: string;
  }>;
}) {
  const user = await appUser();
  if (
    !["SUPER_OWNER", "ADMIN", "REVIEWER"].includes(user.role) ||
    !hasPermission(user, "applications.read")
  )
    redirect("/forbidden");
  const q = await searchParams;
  const page = Math.max(1, Number(q.page) || 1),
    search = (q.q || "").trim().slice(0, 100);
  const filters = [];
  if (user.role === "REVIEWER")
    filters.push(eq(applications.assignedToId, user.id));
  const chosenStatus = statuses.find((s) => s === q.status);
  if (chosenStatus) filters.push(eq(applications.status, chosenStatus));
  if (q.position) filters.push(eq(applications.positionId, q.position));
  if (search)
    filters.push(
      or(
        ilike(users.username, `%${search}%`),
        ilike(users.email, `%${search}%`),
        ilike(applications.positionTitle, `%${search}%`),
      )!,
    );
  const where = filters.length ? and(...filters) : undefined;
  const rows = await db
    .select({ app: applications, applicant: users })
    .from(applications)
    .innerJoin(users, eq(applications.applicantId, users.id))
    .where(where)
    .orderBy(desc(applications.submittedAt))
    .limit(15)
    .offset((page - 1) * 15);
  const reviewerIds = [
    ...new Set(
      rows.map((r) => r.app.assignedToId).filter((x): x is string => !!x),
    ),
  ];
  const reviewerRows = reviewerIds.length
    ? await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(inArray(users.id, reviewerIds))
    : [];
  const reviewerMap = new Map(reviewerRows.map((r) => [r.id, r.username]));
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(applications)
    .innerJoin(users, eq(applications.applicantId, users.id))
    .where(where);
  const roleList = await db
    .select()
    .from(positions)
    .orderBy(desc(positions.createdAt));
  const pages = Math.max(1, Math.ceil(Number(count) / 15));
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
          <Link className="side-link active" href="/admin">
            ▦ &nbsp; Application queue
          </Link>
          {hasPermission(user, "applicants.manage") && (
            <Link className="side-link" href="/admin/applicants">
              ♙ &nbsp; Applicants
            </Link>
          )}
          {user.role === "SUPER_OWNER" && (
            <Link className="side-link" href="/admin/owner">
              ◇ &nbsp; Owner panel
            </Link>
          )}
          {hasPermission(user, "audit.read") && (
            <Link className="side-link" href="/admin/audit">
              ⌁ &nbsp; Audit history
            </Link>
          )}
          <Link className="side-link" href="/">
            ↗ &nbsp; Public website
          </Link>
          <div className="side-user">
            <span className="avatar">{user.username[0].toUpperCase()}</span>
            <span>
              {user.username}
              <small>{pretty(user.role)}</small>
            </span>
          </div>
        </aside>
        <div className="panel-content">
          <div className="panel-title">
            <div>
              <div className="section-kicker">STAFF REVIEW</div>
              <h1>
                Application <span>queue.</span>
              </h1>
              <p>Review submissions and communicate with candidates.</p>
            </div>
            {user.role === "SUPER_OWNER" && (
              <Link className="button button-outline" href="/admin/owner">
                Owner panel ↗
              </Link>
            )}
          </div>
          <form method="get" className="filter-bar">
            <input
              name="q"
              placeholder="Search applicants or roles"
              defaultValue={search}
            />
            <select name="status" defaultValue={q.status || ""}>
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option value={s} key={s}>
                  {pretty(s)}
                </option>
              ))}
            </select>
            <select name="position" defaultValue={q.position || ""}>
              <option value="">All positions</option>
              {roleList.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <button className="button button-small">Filter</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>APPLICANT</th>
                  <th>POSITION</th>
                  <th>SUBMITTED</th>
                  <th>STATUS</th>
                  <th>REVIEWER</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ app, applicant }) => (
                  <tr key={app.id}>
                    <td>
                      <b>{applicant.username}</b>
                      <small>{applicant.email}</small>
                    </td>
                    <td>{app.positionTitle}</td>
                    <td>
                      {app.submittedAt.toLocaleDateString("en", {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      })}
                    </td>
                    <td>
                      <span
                        className={`status status-${app.status.toLowerCase().replaceAll("_", "-")}`}
                      >
                        {pretty(app.status)}
                      </span>
                    </td>
                    <td>
                      {app.assignedToId
                        ? reviewerMap.get(app.assignedToId) || "—"
                        : "—"}
                    </td>
                    <td>
                      <Link
                        className="table-link"
                        href={`/admin/applications/${app.id}`}
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      No applications match those filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <Link
              href={`?page=${Math.max(1, page - 1)}&q=${encodeURIComponent(search)}&status=${q.status || ""}&position=${q.position || ""}`}
              aria-disabled={page <= 1}
            >
              ← Previous
            </Link>
            <span>
              Page {page} of {pages} · {count} applications
            </span>
            <Link
              href={`?page=${Math.min(pages, page + 1)}&q=${encodeURIComponent(search)}&status=${q.status || ""}&position=${q.position || ""}`}
              aria-disabled={page >= pages}
            >
              Next →
            </Link>
          </div>
          {hasPermission(user, "positions.manage") && (
            <section className="owner-card content-section" id="new-position">
              <div className="section-kicker">RECRUITMENT MANAGEMENT</div>
              <h2>Publish a position</h2>
              <PositionForm />
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
function PositionForm() {
  return (
    <form
      action="/api/owner/positions"
      method="post"
      className="form-card form-grid"
    >
      <label>
        Position title
        <input name="title" maxLength={100} required />
      </label>
      <label>
        Application deadline
        <input type="date" name="deadline" />
      </label>
      <label className="full">
        Role description
        <textarea name="description" rows={3} required />
      </label>
      <label className="full">
        Eligibility / requirements
        <textarea name="requirements" rows={2} />
      </label>
      <div className="full">
        <h3>Application form builder (up to 12 items)</h3>
      </div>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
        <fieldset className="question-fields" key={i}>
          <label>
            Form item {i}
            <input
              name={`question_${i}`}
              placeholder="Question or section heading"
            />
          </label>
          <label>
            Type
            <select name={`type_${i}`}>
              <option value="short">Short text</option>
              <option value="long">Long text</option>
              <option value="choice">Single choice</option>
              <option value="multi">Multiple choice</option>
              <option value="dropdown">Dropdown</option>
              <option value="checkbox">Checkboxes</option>
              <option value="date">Date</option>
              <option value="section">Section heading</option>
            </select>
          </label>
          <label>
            Choices
            <textarea
              name={`options_${i}`}
              rows={2}
              placeholder="One per line, for choice fields"
            />
          </label>
          <label className="inline-check">
            <input type="checkbox" name={`required_${i}`} /> Required
          </label>
          <label>
            Section description
            <input name={`section_${i}`} />
          </label>
        </fieldset>
      ))}
      <div className="full">
        <button className="button">Publish position</button>
      </div>
    </form>
  );
}
