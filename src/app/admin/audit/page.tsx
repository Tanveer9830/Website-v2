import Link from "next/link";
import { redirect } from "next/navigation";
import { AuditTable } from "@/components/AuditTable";
import { appUser, hasPermission } from "@/lib/security";
export const dynamic = "force-dynamic";
export default async function AdminAudit({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await appUser();
  if (!hasPermission(user, "audit.read")) redirect("/forbidden");
  const q = await searchParams;
  return (
    <section className="page-wrap">
      <Link className="back-link" href="/admin">
        ← Admin panel
      </Link>
      <div className="page-heading">
        <div>
          <div className="section-kicker">SECURITY & ACCOUNTABILITY</div>
          <h1>
            Audit <span>history.</span>
          </h1>
        </div>
      </div>
      <AuditTable page={Math.max(1, Number(q.page) || 1)} back="/admin/audit" />
    </section>
  );
}
