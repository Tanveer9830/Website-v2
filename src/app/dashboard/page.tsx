import Link from "next/link";
import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { applications, positions, reviewEvents } from "@/lib/schema";
import { appUser } from "@/lib/security";
export const dynamic = "force-dynamic";
const label = (s: string) =>
  s
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const user = await appUser();
  if (user.role !== "APPLICANT") redirect("/forbidden");
  const [apps, roles, q] = await Promise.all([
    db
      .select()
      .from(applications)
      .where(eq(applications.applicantId, user.id))
      .orderBy(desc(applications.submittedAt)),
    db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.isOpen, true),
          or(
            isNull(positions.deadline),
            gte(positions.deadline, new Date().toISOString().slice(0, 10)),
          ),
        ),
      )
      .orderBy(desc(positions.createdAt)),
    searchParams,
  ]);
  const appIds = apps.map((a) => a.id);
  const events = appIds.length
    ? await db
        .select()
        .from(reviewEvents)
        .where(
          and(
            inArray(reviewEvents.applicationId, appIds),
            eq(reviewEvents.visibleToApplicant, true),
          ),
        )
        .orderBy(desc(reviewEvents.createdAt))
    : [];
  const byApp = new Map<string, typeof events>();
  for (const e of events) {
    const arr = byApp.get(e.applicationId) ?? [];
    arr.push(e);
    byApp.set(e.applicationId, arr);
  }
  return (
    <section className="page-wrap">
      <div className="page-heading">
        <div>
          <div className="section-kicker">APPLICANT WORKSPACE</div>
          <h1>
            Your <span>dashboard.</span>
          </h1>
          <p>
            Welcome back, {user.username}. Track applications and hear from our
            team. <a href="#profile">Edit profile</a>
          </p>
        </div>
        <a className="button" href="#open-roles">
          Explore open roles ↗
        </a>
      </div>
      {q.submitted && (
        <div className="flash success">
          Application submitted. Track its status below.
        </div>
      )}
      {q.error && (
        <div className="flash error">
          {q.error === "closed"
            ? "This position is closed for applications."
            : "You have already applied for this position."}
        </div>
      )}
      <div className="stat-grid applicant-stats">
        <div className="stat-card">
          <span>YOUR APPLICATIONS</span>
          <strong>{apps.length}</strong>
        </div>
        <div className="stat-card">
          <span>IN REVIEW</span>
          <strong>
            {
              apps.filter(
                (a) =>
                  a.status === "REVIEWING" ||
                  a.status === "UNDER_CONSIDERATION",
              ).length
            }
          </strong>
        </div>
        <div className="stat-card">
          <span>OPEN OPPORTUNITIES</span>
          <strong>{roles.length}</strong>
        </div>
      </div>
      <section className="content-section">
        <div className="section-heading">
          <div>
            <div className="section-kicker">APPLICATION ACTIVITY</div>
            <h2>Your applications</h2>
          </div>
        </div>
        {apps.length ? (
          <div className="application-list">
            {apps.map((a) => (
              <article className="application-row" key={a.id}>
                <div>
                  <span className="role-tag">{a.positionTitle}</span>
                  <h3>{a.positionTitle}</h3>
                  <p>
                    Submitted{" "}
                    {a.submittedAt.toLocaleString("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </p>
                </div>
                <span
                  className={`status status-${a.status.toLowerCase().replaceAll("_", "-")}`}
                >
                  {label(a.status)}
                </span>
                <div className="app-messages">
                  {(byApp.get(a.id) ?? []).map((e) => (
                    <div className="message-item" key={e.id}>
                      <b>
                        {e.kind === "MESSAGE"
                          ? "TOP CLOUD · MESSAGE"
                          : "STATUS UPDATE"}
                      </b>
                      <p>{e.content}</p>
                      <small>
                        {e.createdAt.toLocaleDateString("en", {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        })}
                      </small>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state compact">
            <span className="empty-symbol">✳</span>
            <h3>No applications yet</h3>
            <p>
              When you apply for an open position, it will appear here with its
              current status.
            </p>
          </div>
        )}
      </section>
      <section className="content-section" id="open-roles">
        <div className="section-heading">
          <div>
            <div className="section-kicker">TAKE THE NEXT STEP</div>
            <h2>Open positions</h2>
          </div>
        </div>
        {roles.length ? (
          <div className="role-grid">
            {roles.map((p) => (
              <article className="role-card" key={p.id}>
                <span className="role-tag">NOW RECRUITING</span>
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <Link
                  className="button button-outline"
                  href={`/dashboard/apply/${p.id}`}
                >
                  Start application ↗
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state compact">
            <h3>No open positions</h3>
            <p>Check back for future opportunities.</p>
          </div>
        )}
      </section>
      <section className="owner-card" id="profile">
        <div className="section-kicker">APPLICANT ACCOUNT</div>
        <h2>Edit profile</h2>
        <form action="/api/profile" method="post" className="form-grid">
          <label>
            Username
            <input
              name="username"
              defaultValue={user.username}
              minLength={3}
              maxLength={40}
              required
            />
          </label>
          <label>
            Email address
            <input
              type="email"
              name="email"
              defaultValue={user.email}
              required
              maxLength={254}
            />
          </label>
          <div className="full">
            <button className="button">Save profile</button>
          </div>
        </form>
      </section>
    </section>
  );
}
