import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { visibleStudents } from "@/lib/scope";
import { Badge, Empty, PageHeader, Stat, Table, money } from "@/components/ui";
import { markPaid } from "./actions";

export default async function FeesPage() {
  const user = await requireUser(["admin", "student", "parent"]);
  const students = await visibleStudents(user);
  const ids = students.map((s) => s.id);
  const invoices = ids.length
    ? await db.select().from(schema.invoices).where(inArray(schema.invoices.studentId, ids)).orderBy(schema.invoices.dueDate)
    : [];
  const name = new Map(students.map((s) => [s.id, s.name]));
  const todayStr = new Date().toISOString().slice(0, 10);

  const paid = invoices.filter((i) => i.paidAt).reduce((s, i) => s + i.amountCents, 0);
  const due = invoices.filter((i) => !i.paidAt).reduce((s, i) => s + i.amountCents, 0);
  const overdue = invoices.filter((i) => !i.paidAt && i.dueDate < todayStr).reduce((s, i) => s + i.amountCents, 0);

  return (
    <>
      <PageHeader title="Fees" subtitle={user.role === "admin" ? "Track invoices and collections across the school." : "Invoices and payment status."} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Collected" value={money(paid)} tone="good" />
        <Stat label="Outstanding" value={money(due)} tone={due ? "warn" : "good"} />
        <Stat label="Overdue" value={money(overdue)} tone={overdue ? "bad" : "good"} />
      </div>
      {invoices.length === 0 ? <Empty>No invoices.</Empty> : (
        <Table>
          <thead><tr><th className="th">Student</th><th className="th">Invoice</th><th className="th">Due</th><th className="th">Amount</th><th className="th">Status</th>{user.role === "admin" && <th className="th" />}</tr></thead>
          <tbody className="divide-y divide-border">
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className="td font-medium">{name.get(i.studentId)}</td>
                <td className="td">{i.title}</td>
                <td className="td text-muted">{i.dueDate}</td>
                <td className="td tabular-nums">{money(i.amountCents)}</td>
                <td className="td">{i.paidAt ? <Badge tone="good">Paid</Badge> : i.dueDate < todayStr ? <Badge tone="bad">Overdue</Badge> : <Badge tone="warn">Due</Badge>}</td>
                {user.role === "admin" && (
                  <td className="td text-right">
                    {!i.paidAt && (
                      <form action={markPaid}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className="btn-ghost !py-1 text-xs">Mark paid</button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="mt-3 text-xs text-muted">Online card payments (Stripe or a local gateway) plug in here next.</p>
    </>
  );
}
