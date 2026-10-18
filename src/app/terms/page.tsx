import Link from "next/link";
export default function Terms() {
  const support = process.env.SUPPORT_EMAIL || "support@topcloud.example";
  return (
    <section className="page-wrap legal">
      <div className="section-kicker">TOP CLOUD · APPLICANT INFORMATION</div>
      <h1>
        Terms of <span>use.</span>
      </h1>
      <p className="lead">Last updated: October 19, 2026</p>
      <h2>Use of this portal</h2>
      <p>
        Provide accurate information and use this service only to manage your
        own account and recruitment application. Do not attempt to access other
        users' accounts, applications, or staff-only information.
      </p>
      <h2>Recruitment</h2>
      <p>
        Submitting an application does not guarantee an interview or offer. TOP
        CLOUD may update available roles and recruitment decisions. We will
        communicate about applications using account details.
      </p>
      <h2>Account security</h2>
      <p>
        Keep your credentials private and contact support if you believe your
        account has been compromised. Accounts may be suspended to protect
        service or users.
      </p>
      <h2>Contact</h2>
      <p>
        Questions? <a href={`mailto:${support}`}>{support}</a>.
      </p>
      <Link href="/privacy">Read the privacy policy.</Link>
    </section>
  );
}
