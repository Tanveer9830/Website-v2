import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/schema";
export async function AuditTable({
  page,
  back,
}: {
  page: number;
  back: string;
}) {
  const rows = await db
    .select({ event: auditLogs, actor: users })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(30)
    .offset((page - 1) * 30);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs);
  const pages = Math.max(1, Math.ceil(Number(count) / 30));
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>TIME (UTC)</th>
              <th>ACTOR</th>
              <th>EVENT</th>
              <th>DETAIL</th>
              <th>ORIGIN</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ event, actor }) => (
              <tr key={event.id}>
                <td>
                  {event.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                </td>
                <td>{actor?.username || "System"}</td>
                <td>
                  <b>{event.event}</b>
                </td>
                <td>{event.detail}</td>
                <td>{event.ipAddress || "—"}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="table-empty">
                  No audit events.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <Link href={`${back}?page=${Math.max(1, page - 1)}`}>← Previous</Link>
        <span>
          Page {page} of {pages} · {count} events
        </span>
        <Link href={`${back}?page=${Math.min(pages, page + 1)}`}>Next →</Link>
      </div>
    </>
  );
}
