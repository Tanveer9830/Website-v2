import Link from "next/link";
export default function Privacy() {
  const support = process.env.SUPPORT_EMAIL || "support@topcloud.example";
  return (
    <section className="page-wrap legal">
      <div className="section-kicker">TOP CLOUD · APPLICANT INFORMATION</div>
      <h1>
        Privacy <span>policy.</span>
      </h1>
      <p className="lead">Last updated: October 19, 2026</p>
      <h2>Information we collect</h2>
      <p>
        We collect account details you provide (username and email), your
        application answers, and necessary security and review records. Do not
        include sensitive personal information that is not relevant to your
        application.
      </p>
      <h2>How information is used</h2>
      <p>
        Your information is used to administer recruitment, communicate with
        you, protect accounts, and maintain a reliable audit trail. Application
        details are visible only to the applicant and authorized TOP CLOUD
        staff. Internal reviewer notes are not displayed to applicants.
      </p>
      <h2>Retention and requests</h2>
      <p>
        Recruitment records are retained only as long as operational, legal, and
        security needs require. For access or deletion requests, contact{" "}
        <a href={`mailto:${support}`}>{support}</a>. Requests may be limited
        where records must be preserved for legitimate obligations.
      </p>
      <h2>Security</h2>
      <p>
        Passwords are securely hashed, sessions use protected cookies, and
        sensitive changes are audited. No internet service can guarantee
        absolute security.
      </p>
      <p>
        <Link href="/terms">Read the terms of use.</Link>
      </p>
    </section>
  );
}
