import Link from "next/link";
import { and, asc, eq, gte, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { positions, siteSettings } from "@/lib/schema";
import { currentUser } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [roles, settings, user] = await Promise.all([
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
      .orderBy(asc(positions.createdAt)),
    db.select().from(siteSettings),
    currentUser(),
  ]);
  const config = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const paused = config.maintenance_mode === "true";
  return (
    <>
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-content">
          <div className="eyebrow">
            <i /> RECRUITMENT{" "}
            <span className={paused || !roles.length ? "closed" : "live"}>
              {paused || !roles.length ? "CLOSED" : "OPEN"}
            </span>
          </div>
          <h1>
            Build the cloud.
            <br />
            <span>Shape what’s next.</span>
          </h1>
          <p>
            Bring your curiosity, craft, and care to a team making hosting
            simpler and more reliable. Find your place at TOP CLOUD.
          </p>
          <div className="hero-actions">
            <Link
              className="button"
              href={user?.role === "APPLICANT" ? "/dashboard" : "/register"}
            >
              Apply for staff <span>↗</span>
            </Link>
            <Link className="text-link" href="#roles">
              Explore positions ↓
            </Link>
          </div>
          <div className="hero-meta">
            <span>
              <b>01</b> Find your role
            </span>
            <span>
              <b>02</b> Tell us your story
            </span>
            <span>
              <b>03</b> Grow together
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="cloud-core">
            <span>TC</span>
          </div>
          <div className="float-card float-a">
            <i className="dot cyan" /> Reliable by design
          </div>
          <div className="float-card float-b">
            <i className="dot violet" /> People-first team
          </div>
          <div className="art-caption">HOSTING, WITH HUMANITY.</div>
        </div>
        <div className="hero-bottom">
          <span>01 / 04</span>
          <span>STAFF APPLICATIONS · TOP CLOUD</span>
          <span>SCROLL TO EXPLORE ↓</span>
        </div>
      </section>
      {config.announcement && !paused && (
        <div className="announcement">{config.announcement}</div>
      )}
      {paused && (
        <div className="announcement">
          Recruitment is temporarily paused while we make improvements. Please
          check back soon.
        </div>
      )}
      <section className="section" id="about">
        <div className="section-kicker">A DIFFERENT KIND OF CLOUD</div>
        <div className="split-heading">
          <h2>
            Infrastructure is important.
            <br />
            <span>People make it matter.</span>
          </h2>
          <p>
            {config.about_text ||
              "TOP CLOUD is built around dependable hosting, thoughtful support, and a community that helps people do their best work. We are growing a team of curious problem-solvers who care about the details and the people behind every service."}
          </p>
        </div>
        <div className="feature-row">
          <article>
            <span className="feature-icon">◉</span>
            <h3>Reliability first</h3>
            <p>
              Thoughtful operations and careful ownership keep the foundation
              strong.
            </p>
          </article>
          <article>
            <span className="feature-icon">⌘</span>
            <h3>Room to contribute</h3>
            <p>
              Bring ideas, take initiative, and make meaningful improvements.
            </p>
          </article>
          <article>
            <span className="feature-icon">↗</span>
            <h3>Grow together</h3>
            <p>
              Learn alongside a respectful team that values clear communication.
            </p>
          </article>
        </div>
      </section>
      <section className="section roles-section" id="roles">
        <div className="section-heading">
          <div>
            <div className="section-kicker">YOUR NEXT CHAPTER</div>
            <h2>
              Find your <span>position.</span>
            </h2>
          </div>
          <span className="count-pill">
            {roles.length} OPEN ROLE{roles.length === 1 ? "" : "S"}
          </span>
        </div>
        {roles.length && !paused ? (
          <div className="role-grid">
            {roles.map((p) => (
              <article className="role-card" key={p.id}>
                <div className="role-top">
                  <span className="role-tag">TEAM OPPORTUNITY</span>
                  <span className="open-indicator">● Open</span>
                </div>
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <div className="requirements">
                  <b>WHAT HELPS</b>
                  <p>
                    {p.requirements ||
                      "Curiosity, reliability, and a willingness to learn."}
                  </p>
                </div>
                {p.deadline && (
                  <div className="deadline">
                    Applications close{" "}
                    {new Date(`${p.deadline}T00:00:00`).toLocaleDateString(
                      "en",
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </div>
                )}
                <Link
                  className="button button-outline"
                  href={
                    user?.role === "APPLICANT"
                      ? `/dashboard/apply/${p.id}`
                      : "/register"
                  }
                >
                  View and apply <span>↗</span>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-symbol">✳</span>
            <h3>No open roles right now</h3>
            <p>
              We are not accepting applications at this time. Check back soon
              for new opportunities.
            </p>
          </div>
        )}
      </section>
      <section className="section process-section">
        <div className="section-kicker">CLEAR FROM DAY ONE</div>
        <h2>
          A thoughtful process.
          <br />
          <span>No surprises.</span>
        </h2>
        <div className="process-grid">
          {[
            [
              "01",
              "Apply",
              "Choose a role and share your experience through our secure application form.",
            ],
            [
              "02",
              "Review",
              "Our team reviews every application carefully and may follow up with questions.",
            ],
            [
              "03",
              "Connect",
              "Meet the people you would work with and talk through the role together.",
            ],
            [
              "04",
              "Decide",
              "We will communicate the outcome and next steps directly in your dashboard.",
            ],
          ].map(([n, t, d]) => (
            <div key={n}>
              <b>{n}</b>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="section faq-section">
        <div>
          <div className="section-kicker">GOOD TO KNOW</div>
          <h2>
            Frequently
            <br />
            <span>asked.</span>
          </h2>
          <p>
            Still have a question?{" "}
            <a
              href={`mailto:${config.support_email || process.env.SUPPORT_EMAIL || "support@topcloud.example"}`}
            >
              Get in touch ↗
            </a>
          </p>
        </div>
        <div className="faq-list">
          {[
            [
              "What should I include in my application?",
              "Share relevant experience, examples of your work where appropriate, and why this opportunity interests you.",
            ],
            [
              "Can I apply for more than one position?",
              "Yes. Submit a separate application for each open position that matches your interests.",
            ],
            [
              "How do I track my application?",
              "Sign in and visit your applicant dashboard. Status updates and messages from our team appear there.",
            ],
            [
              "How do you handle my personal information?",
              "We use your application details only for recruitment and restrict access to authorized staff.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="cta-band">
        <div>
          <div className="section-kicker">YOUR WORK CAN MAKE A DIFFERENCE</div>
          <h2>Ready to make an impact?</h2>
          <p>Take the first step and apply to join TOP CLOUD.</p>
        </div>
        <Link
          className="button"
          href={user?.role === "APPLICANT" ? "/dashboard" : "/register"}
        >
          Apply for staff <span>↗</span>
        </Link>
      </section>
    </>
  );
}
