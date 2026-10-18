import Link from "next/link";
import { and, eq, gte, isNull, or } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { positions, siteSettings } from "@/lib/schema";
import { appUser } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await appUser();
  if (user.role !== "APPLICANT") redirect("/forbidden");
  const { id } = await params;
  const [p] = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.id, id),
        eq(positions.isOpen, true),
        or(
          isNull(positions.deadline),
          gte(positions.deadline, new Date().toISOString().slice(0, 10)),
        ),
      ),
    )
    .limit(1);
  const [maintenance] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, "maintenance_mode"))
    .limit(1);
  if (!p || maintenance?.value === "true") notFound();
  const schema = p.formSchema;
  return (
    <section className="page-wrap narrow">
      <Link className="back-link" href="/dashboard">
        ← Applicant dashboard
      </Link>
      <div className="section-kicker">STAFF APPLICATION</div>
      <h1>
        Apply for <span>{p.title}.</span>
      </h1>
      <p className="lead">{p.description}</p>
      {p.requirements && (
        <div className="notice-box">
          <b>What helps</b>
          <p>{p.requirements}</p>
        </div>
      )}
      {(await searchParams).error && (
        <div className="flash error">
          Please review required fields and make sure each answer is valid.
        </div>
      )}
      <form action="/api/applications" method="post" className="form-card">
        <input type="hidden" name="positionId" value={p.id} />
        {schema.map((q) =>
          q.type === "section" ? (
            <div className="form-section-title" key={q.id}>
              <h3>{q.label}</h3>
              <p>{q.description}</p>
            </div>
          ) : (
            <label key={q.id}>
              {q.label}
              {q.required && <span className="required"> *</span>}
              {q.type === "long" ? (
                <textarea
                  name={`q_${q.id}`}
                  rows={5}
                  maxLength={5000}
                  required={q.required}
                />
              ) : ["choice", "dropdown"].includes(q.type) ? (
                <select name={`q_${q.id}`} required={q.required}>
                  <option value="">Choose an option</option>
                  {(q.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : ["multi", "checkbox"].includes(q.type) ? (
                <div className="checkbox-list">
                  {(q.options ?? []).map((o) => (
                    <label className="check-label" key={o}>
                      <input type="checkbox" name={`q_${q.id}`} value={o} />
                      {o}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  type={q.type === "date" ? "date" : "text"}
                  name={`q_${q.id}`}
                  maxLength={5000}
                  required={q.required}
                />
              )}
            </label>
          ),
        )}
        <div className="form-footer">
          <p>
            By submitting, you confirm this information is accurate and agree to
            our <Link href="/privacy">privacy policy</Link>.
          </p>
          <button className="button">Submit application ↗</button>
        </div>
      </form>
    </section>
  );
}
