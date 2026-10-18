import Link from "next/link";
export default function Forbidden() {
  return (
    <section className="error-page">
      <div className="error-code">403</div>
      <h1>Access restricted.</h1>
      <p>This account is not authorized to open that area.</p>
      <Link className="button" href="/">
        Back to TOP CLOUD
      </Link>
    </section>
  );
}
