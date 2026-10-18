import Link from "next/link";
import { and, asc, desc, eq, inArray, or, arrayContains } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { applications, reviewEvents, users } from "@/lib/schema";
import { appUser, canViewApplication, hasPermission } from "@/lib/security";
export const dynamic = "force-dynamic";
const statuses = [
  "PENDING",
  "REVIEWING",
  "UNDER_CONSIDERATION",
  "APPROVED",
  "REJECTED",
  "ON_HOLD",
];
const pretty = (s: string) =>
  s
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
const displayAnswer = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.join(", ") : value || "—";
export default async function ApplicationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await appUser();
  if (!["SUPER_OWNER", "ADMIN", "REVIEWER"].includes(user.role))
    redirect("/forbidden");
  const { id } = await params;
  const [record] = await db
    .select({ app: applications, applicant: users })
    .from(applications)
    .innerJoin(users, eq(applications.applicantId, users.id))
    .where(eq(applications.id, id))
    .limit(1);
  if (!record) notFound();
  const { app, applicant } = record;
  if (!canViewApplication(user, app)) redirect("/forbidden");
  const ev = await db
    .select({ event: reviewEvents, actor: users })
    .from(reviewEvents)
    .innerJoin(users, eq(reviewEvents.actorId, users.id))
    .where(eq(reviewEvents.applicationId, app.id))
    .orderBy(desc(reviewEvents.createdAt));
  const staff = hasPermission(user, "applications.assign")
    ? await db
        .select({ id: users.id, username: users.username, role: users.role })
        .from(users)
        .where(
          and(
            inArray(users.role, ["ADMIN", "REVIEWER"]),
            eq(users.status, "ACTIVE"),
            or(
              eq(users.role, "REVIEWER"),
              and(
                eq(users.role, "ADMIN"),
                arrayContains(users.permissions, [
                  "applications.read",
                  "applications.review",
                ]),
              ),
            ),
          ),
        )
        .orderBy(asc(users.username))
    : [];
  const answers = app.answers as Record<string, string | string[]>;
  const snapshot = app.schemaSnapshot;
  return (
    <section className="page-wrap">
      <Link className="back-link" href="/admin">
        ← Application queue
      </Link>
      <div className="detail-heading">
        <div>
          <div className="section-kicker">
            APPLICATION #{app.id.slice(0, 8)} · SUBMITTED{" "}
            {app.submittedAt.toLocaleString("en", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC",
            })}{" "}
            UTC
          </div>
          <h1>
            {applicant.username} <span>· {app.positionTitle}</span>
          </h1>
          <p>
            <a href={`mailto:${applicant.email}`}>{applicant.email}</a> ·
            Account {pretty(applicant.status)}
          </p>
        </div>
        <span
          className={`status status-${app.status.toLowerCase().replaceAll("_", "-")}`}
        >
          {pretty(app.status)}
        </span>
      </div>
      <div className="detail-grid">
        <div className="detail-main">
          <section className="owner-card">
            <div className="card-heading">
              <div>
                <div className="section-kicker">
                  SUBMITTED FORM · VERSION SNAPSHOT
                </div>
                <h2>Application answers</h2>
              </div>
            </div>
            {snapshot.map((q) =>
              q.type === "section" ? (
                <div className="answer-section" key={q.id}>
                  <h3>{q.label}</h3>
                  <p>{q.description}</p>
                </div>
              ) : (
                <div className="answer-item" key={q.id}>
                  <span>
                    {q.label}
                    {q.required ? " *" : ""}
                  </span>
                  <p>{displayAnswer(answers[q.id])}</p>
                </div>
              ),
            )}
          </section>
          <section className="owner-card">
            <div className="card-heading">
              <div>
                <div className="section-kicker">REVIEW TIMELINE</div>
                <h2>History & communication</h2>
              </div>
            </div>
            {ev.map(({ event, actor }) => (
              <div className="timeline-item" key={event.id}>
                <i
                  className={`timeline-dot ${event.visibleToApplicant ? "cyan" : ""}`}
                />
                <div>
                  <div className="timeline-head">
                    <b>
                      {event.kind === "STATUS"
                        ? "Status changed"
                        : event.kind === "NOTE"
                          ? "Internal note"
                          : event.kind === "MESSAGE"
                            ? "Applicant message"
                            : "Reviewer assignment"}
                    </b>
                    <small>
                      {event.createdAt.toLocaleString("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "UTC",
                      })}{" "}
                      UTC
                    </small>
                  </div>
                  <p>{event.content}</p>
                  <small>
                    By {actor.username}
                    {event.visibleToApplicant
                      ? " · Applicant visible"
                      : " · Staff only"}
                  </small>
                </div>
              </div>
            ))}
          </section>
        </div>
        <aside className="detail-side">
          {hasPermission(user, "applications.review") && (
            <>
              <section className="owner-card">
                <div className="section-kicker">REVIEW CONTROLS</div>
                <h2>Update status</h2>
                <form
                  action={`/api/applications/${app.id}/review`}
                  method="post"
                  className="form-stack"
                >
                  <input type="hidden" name="action" value="status" />
                  <select name="status" defaultValue={app.status}>
                    {statuses.map((s) => (
                      <option value={s} key={s}>
                        {pretty(s)}
                      </option>
                    ))}
                  </select>
                  <button className="button button-wide">Save status</button>
                </form>
                {hasPermission(user, "applications.assign") && (
                  <>
                    <hr />
                    <h3>Assign reviewer</h3>
                    <form
                      action={`/api/applications/${app.id}/review`}
                      method="post"
                      className="form-stack"
                    >
                      <input type="hidden" name="action" value="assign" />
                      <select
                        name="reviewerId"
                        defaultValue={app.assignedToId || ""}
                        required
                      >
                        <option value="">Choose staff member</option>
                        {staff.map((s) => (
                          <option value={s.id} key={s.id}>
                            {s.username} · {s.role}
                          </option>
                        ))}
                      </select>
                      <button className="button button-outline button-wide">
                        Assign application
                      </button>
                    </form>
                  </>
                )}
              </section>
              <section className="owner-card">
                <div className="section-kicker">STAFF ONLY</div>
                <h2>Internal note</h2>
                <p className="muted">
                  Only authorized staff can see this note.
                </p>
                <form
                  action={`/api/applications/${app.id}/review`}
                  method="post"
                  className="form-stack"
                >
                  <input type="hidden" name="action" value="note" />
                  <textarea
                    name="content"
                    rows={4}
                    maxLength={5000}
                    required
                    placeholder="Private review notes"
                  />
                  <button className="button button-outline button-wide">
                    Add internal note
                  </button>
                </form>
              </section>
              <section className="owner-card">
                <div className="section-kicker">APPLICANT VISIBLE</div>
                <h2>Send a message</h2>
                <p className="muted">
                  The applicant can read this in their dashboard.
                </p>
                <form
                  action={`/api/applications/${app.id}/review`}
                  method="post"
                  className="form-stack"
                >
                  <input type="hidden" name="action" value="message" />
                  <textarea
                    name="content"
                    rows={4}
                    maxLength={5000}
                    required
                    placeholder="A clear, respectful message"
                  />
                  <button className="button button-wide">Send message</button>
                </form>
              </section>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
