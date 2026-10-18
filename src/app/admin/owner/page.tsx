import Link from "next/link";
import { and, desc, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  applications,
  auditLogs,
  positions,
  siteSettings,
  users,
} from "@/lib/schema";
import { appUser, PERMISSIONS } from "@/lib/security";
import { PositionEditor } from "@/components/PositionEditor";
export const dynamic = "force-dynamic";
const pretty = (s: string) =>
  s
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export default async function Owner({
  searchParams,
}: {
  searchParams: Promise<{
    start?: string;
    end?: string;
    position?: string;
    error?: string;
    staffpage?: string;
  }>;
}) {
  const user = await appUser();
  if (user.role !== "SUPER_OWNER") redirect("/forbidden");
  const q = await searchParams;
  const staffPage = Math.max(1, Number(q.staffpage) || 1);
  const validDate = (s?: string) =>
    s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : undefined;
  const start = validDate(q.start),
    end = validDate(q.end);
  const base: SQL[] = [];
  if (start && !Number.isNaN(start.valueOf()))
    base.push(gte(applications.submittedAt, start));
  if (end && !Number.isNaN(end.valueOf())) {
    const next = new Date(end);
    next.setUTCDate(next.getUTCDate() + 1);
    base.push(lt(applications.submittedAt, next));
  }
  if (q.position) base.push(eq(applications.positionId, q.position));
  const where = base.length ? and(...base) : undefined;
  const count = async (status?: typeof applications.$inferSelect.status) => {
    const conditions = [
      ...base,
      ...(status ? [eq(applications.status, status)] : []),
    ];
    const [r] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(applications)
      .where(conditions.length ? and(...conditions) : undefined);
    return Number(r?.count ?? 0);
  };
  const [
    applicantCount,
    total,
    pending,
    reviewing,
    approved,
    rejected,
    openCount,
    closedCount,
    recent,
    activity,
    roles,
    staff,
    staffTotal,
    settings,
    trend,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "APPLICANT"))
      .then((r) => Number(r[0]?.count ?? 0)),
    count(),
    count("PENDING"),
    count("REVIEWING").then(
      async (a) => a + (await count("UNDER_CONSIDERATION")),
    ),
    count("APPROVED"),
    count("REJECTED"),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(positions)
      .where(eq(positions.isOpen, true))
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(positions)
      .where(eq(positions.isOpen, false))
      .then((r) => Number(r[0]?.count ?? 0)),
    db
      .select({ app: applications, applicant: users })
      .from(applications)
      .innerJoin(users, eq(applications.applicantId, users.id))
      .where(where)
      .orderBy(desc(applications.submittedAt))
      .limit(8),
    db
      .select({ event: auditLogs, actor: users })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10),
    db.select().from(positions).orderBy(desc(positions.createdAt)),
    db
      .select()
      .from(users)
      .where(inArray(users.role, ["ADMIN", "REVIEWER"]))
      .orderBy(desc(users.createdAt))
      .limit(15)
      .offset((staffPage - 1) * 15),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(inArray(users.role, ["ADMIN", "REVIEWER"]))
      .then((r) => Number(r[0]?.count ?? 0)),
    db.select().from(siteSettings),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day',${applications.submittedAt} AT TIME ZONE 'UTC'),'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(applications)
      .where(where)
      .groupBy(
        sql`date_trunc('day',${applications.submittedAt} AT TIME ZONE 'UTC')`,
      )
      .orderBy(
        sql`date_trunc('day',${applications.submittedAt} AT TIME ZONE 'UTC') DESC`,
      )
      .limit(14),
  ]);
  const config = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const workload = await db
    .select({ username: users.username, count: sql<number>`count(*)::int` })
    .from(applications)
    .innerJoin(users, eq(applications.assignedToId, users.id))
    .where(where)
    .groupBy(users.username)
    .orderBy(desc(sql`count(*)`))
    .limit(8);
  const applicationCounts = await db
    .select({
      positionId: applications.positionId,
      count: sql<number>`count(*)::int`,
    })
    .from(applications)
    .groupBy(applications.positionId);
  const countsByPosition = new Map(
    applicationCounts.map((row) => [row.positionId, Number(row.count)]),
  );
  return (
    <section className="page-wrap">
      <div className="panel-head">
        <aside className="sidebar">
          <Link className="side-logo" href="/">
            <span className="brand-icon">TC</span>
            <span>
              TOP CLOUD<small>OWNER CONSOLE</small>
            </span>
          </Link>
          <div className="side-label">CONTROL CENTER</div>
          <Link className="side-link active" href="/admin/owner">
            ◈ &nbsp; Overview
          </Link>
          <Link className="side-link" href="/admin">
            ▦ &nbsp; Admin panel
          </Link>
          <Link className="side-link" href="/admin#applications">
            ▤ &nbsp; Applications
          </Link>
          <Link className="side-link" href="#positions">
            ◉ &nbsp; Positions & forms
          </Link>
          <Link className="side-link" href="#staff">
            ♙ &nbsp; Staff & permissions
          </Link>
          <Link className="side-link" href="#site-settings">
            ⚙ &nbsp; Site settings
          </Link>
          <Link className="side-link" href="/admin/owner/audit">
            ⌁ &nbsp; Audit log
          </Link>
          <div className="side-user">
            <span className="avatar">T</span>
            <span>
              tanveer<small>SUPER OWNER</small>
            </span>
          </div>
        </aside>
        <div className="panel-content">
          <div className="panel-title">
            <div>
              <div className="section-kicker">
                SYSTEM OVERVIEW · SUPER OWNER
              </div>
              <h1>
                Owner <span>control center.</span>
              </h1>
              <p>
                Full recruitment visibility, account controls, and review
                activity.
              </p>
            </div>
            <Link className="button button-outline" href="/admin">
              Switch to Admin panel ↗
            </Link>
          </div>
          {q.error && (
            <div className="flash error">
              The submitted information could not be saved. Check required
              fields and try again.
            </div>
          )}
          <form className="filter-bar analytics-filters" method="get">
            <label>
              From
              <input type="date" name="start" defaultValue={q.start} />
            </label>
            <label>
              To
              <input type="date" name="end" defaultValue={q.end} />
            </label>
            <label>
              Position
              <select name="position" defaultValue={q.position || ""}>
                <option value="">All positions</option>
                {roles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-small">Apply filters</button>
            <Link className="text-link" href="/admin/owner">
              Clear
            </Link>
          </form>
          <div className="stat-grid">
            <Stat
              label="REGISTERED APPLICANTS"
              value={applicantCount}
              detail="All applicant accounts"
            />
            <Stat
              label="TOTAL APPLICATIONS"
              value={total}
              detail="Within selected date filters"
            />
            <Stat
              label="PENDING"
              value={pending}
              detail="Awaiting first review"
            />
            <Stat
              label="IN REVIEW"
              value={reviewing}
              detail="Reviewing or considering"
            />
            <Stat
              label="APPROVED"
              value={approved}
              detail="Successful applications"
            />
            <Stat
              label="REJECTED"
              value={rejected}
              detail="Closed applications"
            />
            <Stat
              label="OPEN POSITIONS"
              value={openCount}
              detail="Accepting applications"
            />
            <Stat
              label="CLOSED POSITIONS"
              value={closedCount}
              detail="Not accepting applications"
            />
          </div>
          <div className="owner-columns">
            <section className="owner-card">
              <div className="card-heading">
                <div>
                  <div className="section-kicker">LATEST SUBMISSIONS</div>
                  <h2>Recent applications</h2>
                </div>
                <Link href="/admin">Full queue →</Link>
              </div>
              {recent.length ? (
                <div className="mini-list">
                  {recent.map(({ app, applicant }) => (
                    <Link href={`/admin/applications/${app.id}`} key={app.id}>
                      <span className="avatar small">
                        {applicant.username[0].toUpperCase()}
                      </span>
                      <span>
                        <b>{applicant.username}</b>
                        <small>
                          {app.positionTitle} ·{" "}
                          {app.submittedAt.toLocaleDateString("en", {
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          })}
                        </small>
                      </span>
                      <span
                        className={`status status-${app.status.toLowerCase().replaceAll("_", "-")}`}
                      >
                        {pretty(app.status)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Nothing submitted yet"
                  text="New applications will appear here."
                />
              )}
            </section>
            <section className="owner-card">
              <div className="card-heading">
                <div>
                  <div className="section-kicker">APPLICATION TRENDS</div>
                  <h2>Daily submissions</h2>
                </div>
              </div>
              {trend.length ? (
                <div className="trend-list">
                  {[...trend].reverse().map((t) => (
                    <div className="trend-row" key={t.day}>
                      <span>{t.day}</span>
                      <div>
                        <i
                          style={{
                            width: `${Math.min(100, Number(t.count) * 18)}%`,
                          }}
                        />
                      </div>
                      <b>{t.count}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Trend data will appear here"
                  text="No applications match these filters."
                />
              )}
            </section>
          </div>
          <section className="owner-card">
            <div className="card-heading">
              <div>
                <div className="section-kicker">REVIEW WORKLOAD</div>
                <h2>Assigned applications</h2>
              </div>
            </div>
            {workload.length ? (
              <div className="mini-list">
                {workload.map((row) => (
                  <div className="audit-row" key={row.username}>
                    <span className="activity-dot" />
                    <b>{row.username}</b>
                    <span>
                      {row.count} assigned application
                      {Number(row.count) === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No reviewer assignments yet"
                text="Assignment workload appears as cases are allocated."
              />
            )}
          </section>
          <section className="owner-card activity-card">
            <div className="card-heading">
              <div>
                <div className="section-kicker">SECURITY & OPERATIONS</div>
                <h2>Recent administrative activity</h2>
              </div>
              <Link href="/admin/owner/audit">Full audit log →</Link>
            </div>
            {activity.map(({ event, actor }) => (
              <div className="audit-row" key={event.id}>
                <span className="activity-dot" />
                <b>{event.event}</b>
                <span>
                  {event.detail} {actor ? `· ${actor.username}` : ""}
                </span>
                <small>
                  {event.createdAt.toLocaleString("en", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </small>
              </div>
            ))}
            {!activity.length && (
              <Empty
                title="No administrative activity yet"
                text="Important account and recruitment events will be recorded here."
              />
            )}
            <div className="health-row">
              <span className="health-dot" /> Application server operational{" "}
              <span className="muted">
                Database health at <a href="/api/health">/api/health</a>
              </span>
            </div>
          </section>
          <section className="owner-card" id="positions">
            <div className="card-heading">
              <div>
                <div className="section-kicker">RECRUITMENT CONTENT</div>
                <h2>Positions & deadlines</h2>
              </div>
              <span className="count-pill">{roles.length} TOTAL</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>POSITION</th>
                    <th>DEADLINE</th>
                    <th>APPLICATIONS</th>
                    <th>STATE</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b>{p.title}</b>
                        <small>{p.description.slice(0, 90)}</small>
                      </td>
                      <td>{p.deadline || "Not set"}</td>
                      <td>{countsByPosition.get(p.id) || 0}</td>
                      <td>
                        <span
                          className={
                            p.isOpen ? "open-indicator" : "closed-indicator"
                          }
                        >
                          ● {p.isOpen ? "Open" : "Closed"}
                        </span>
                      </td>
                      <td>
                        <form
                          action={`/api/owner/positions/${p.id}`}
                          method="post"
                        >
                          <input type="hidden" name="action" value="toggle" />
                          <button className="table-link">
                            {p.isOpen ? "Close" : "Reopen"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {!roles.length && (
                    <tr>
                      <td colSpan={5} className="table-empty">
                        No positions published yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {roles.map((p) => (
              <details className="owner-details" key={`edit-${p.id}`}>
                <summary>Edit {p.title} · form and role content</summary>
                <PositionEditor
                  action={`/api/owner/positions/${p.id}`}
                  position={{ ...p, deadline: p.deadline ?? null }}
                  updateSchema
                />
              </details>
            ))}
            <details className="owner-details">
              <summary>+ Create a recruitment position</summary>
              <PositionEditor action="/api/owner/positions" />
            </details>
          </section>
          <section className="owner-card" id="staff">
            <div className="card-heading">
              <div>
                <div className="section-kicker">ACCESS CONTROL</div>
                <h2>Staff accounts & permissions</h2>
                <p>
                  Only the Super Owner can grant elevated roles. New staff
                  choose a new password at first login.
                </p>
              </div>
            </div>
            <details className="owner-details" open>
              <summary>+ Create admin or reviewer account</summary>
              <form
                className="form-card form-grid"
                method="post"
                action="/api/owner/staff"
              >
                <label>
                  Username
                  <input
                    name="username"
                    minLength={3}
                    maxLength={40}
                    pattern="[A-Za-z0-9_]+"
                    required
                  />
                </label>
                <label>
                  Email
                  <input type="email" name="email" required />
                </label>
                <label>
                  Temporary password
                  <input
                    type="password"
                    name="password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                </label>
                <label>
                  Role
                  <select name="role">
                    <option value="ADMIN">ADMIN</option>
                    <option value="REVIEWER">REVIEWER</option>
                  </select>
                </label>
                <fieldset className="full permission-set">
                  <legend>
                    Admin permissions (reviewers receive assigned-case review
                    permissions)
                  </legend>
                  {PERMISSIONS.map((p) => (
                    <label className="check-label" key={p}>
                      <input
                        type="checkbox"
                        name="permissions"
                        value={p}
                        defaultChecked={[
                          "applications.read",
                          "applications.review",
                        ].includes(p)}
                      />
                      {p}
                    </label>
                  ))}
                </fieldset>
                <div className="full">
                  <button className="button">Create staff account</button>
                </div>
              </form>
            </details>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ACCOUNT</th>
                    <th>ROLE</th>
                    <th>PERMISSIONS</th>
                    <th>STATUS</th>
                    <th>MANAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <b>{s.username}</b>
                        <small>{s.email}</small>
                      </td>
                      <td>{s.role}</td>
                      <td>{s.permissions.join(", ") || "None"}</td>
                      <td>{pretty(s.status)}</td>
                      <td>
                        <details>
                          <summary className="table-link">Manage</summary>
                          <form
                            method="post"
                            action={`/api/owner/staff/${s.id}`}
                            className="form-stack"
                            data-confirm="Save account permissions?"
                          >
                            <input
                              type="hidden"
                              name="action"
                              value="permissions"
                            />
                            <select name="role" defaultValue={s.role}>
                              <option value="ADMIN">ADMIN</option>
                              <option value="REVIEWER">REVIEWER</option>
                            </select>
                            {PERMISSIONS.map((p) => (
                              <label className="check-label" key={p}>
                                <input
                                  type="checkbox"
                                  name="permissions"
                                  value={p}
                                  defaultChecked={s.permissions.includes(p)}
                                />
                                {p}
                              </label>
                            ))}
                            <button className="table-link">
                              Save permissions
                            </button>
                          </form>
                          <form
                            method="post"
                            action={`/api/owner/staff/${s.id}`}
                          >
                            <input
                              type="hidden"
                              name="action"
                              value={
                                s.status === "ACTIVE" ? "disable" : "enable"
                              }
                            />
                            <button className="table-link">
                              {s.status === "ACTIVE" ? "Disable" : "Enable"}{" "}
                              account
                            </button>
                          </form>
                        </details>
                      </td>
                    </tr>
                  ))}
                  {!staff.length && (
                    <tr>
                      <td colSpan={5} className="table-empty">
                        No staff accounts created.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <Link
                href={`/admin/owner?staffpage=${Math.max(1, staffPage - 1)}#staff`}
              >
                ← Previous
              </Link>
              <span>
                Page {staffPage} of {Math.max(1, Math.ceil(staffTotal / 15))} ·{" "}
                {staffTotal} staff accounts
              </span>
              <Link
                href={`/admin/owner?staffpage=${Math.min(Math.max(1, Math.ceil(staffTotal / 15)), staffPage + 1)}#staff`}
              >
                Next →
              </Link>
            </div>
            <p>
              <Link href="/admin/applicants">Manage applicant accounts →</Link>
            </p>
          </section>
          <section className="owner-card" id="site-settings">
            <div className="card-heading">
              <div>
                <div className="section-kicker">PUBLIC WEBSITE</div>
                <h2>Content, support & maintenance</h2>
                <p>These values appear on the public recruitment site.</p>
              </div>
            </div>
            <form
              className="form-card form-grid"
              method="post"
              action="/api/owner/settings"
            >
              <label className="full">
                About TOP CLOUD
                <textarea
                  name="about_text"
                  rows={3}
                  defaultValue={config.about_text || ""}
                  maxLength={3000}
                />
              </label>
              <label>
                Support email
                <input
                  type="email"
                  name="support_email"
                  defaultValue={
                    config.support_email ||
                    process.env.SUPPORT_EMAIL ||
                    "support@topcloud.example"
                  }
                  required
                />
              </label>
              <label>
                Recruitment announcement
                <input
                  name="announcement"
                  defaultValue={config.announcement || ""}
                  maxLength={1000}
                />
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  name="maintenance_mode"
                  defaultChecked={config.maintenance_mode === "true"}
                />{" "}
                Pause public applications (maintenance mode)
              </label>
              <div className="full">
                <button className="button">Save site settings</button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </section>
  );
}
function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state compact">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
