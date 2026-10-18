import Link from "next/link";
import { redirect } from "next/navigation";
import { AuditTable } from "@/components/AuditTable";
import { appUser } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function OwnerAudit({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await appUser();
  if (user.role !== "SUPER_OWNER") redirect("/forbidden");
  const q = await searchParams;
  return (
    <section className="page-wrap">
      <Link className="back-link" href="/admin/owner">
        ← Owner control center
      </Link>
      <div className="page-heading">
        <div>
          <div className="section-kicker">SECURITY & ACCOUNTABILITY</div>
          <h1>
            Audit <span>log.</span>
          </h1>
          <p>
            Recorded authentication and administrative activity. Sensitive
            values are never logged.
          </p>
        </div>
      </div>
      <AuditTable
        page={Math.max(1, Number(q.page) || 1)}
        back="/admin/owner/audit"
      />
    </section>
  );
}
