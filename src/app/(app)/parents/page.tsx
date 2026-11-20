import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { formatPkMobile, telHref } from "@/lib/pk";
import { isAutoParentEmail } from "@/lib/parents";
import { summarizeParent } from "@/lib/parent-details";
import { Badge, Empty, PageHeader, Table } from "@/components/ui";
import { RevealButton, ResetButton } from "./credential-buttons";

export default async function ParentsPage() {
  const me = await requireUser(["admin"]);
  const parents = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.schoolId, me.schoolId))
    .then((rows) => rows.filter((u) => u.role === "parent").sort((a, b) => a.name.localeCompare(b.name)));
  const ids = parents.map((p) => p.id);
  const kids = ids.length
    ? await db
        .select({
          id: schema.students.id,
          name: schema.students.name,
          guardianId: schema.students.guardianId,
          guardianName: schema.students.guardianName,
          guardianPhone: schema.students.guardianPhone,
          guardianCnic: schema.students.guardianCnic,
          cls: schema.classes.name,
          section: schema.classes.section,
        })
        .from(schema.students)
        .leftJoin(schema.classes, eq(schema.classes.id, schema.students.classId))
        .where(inArray(schema.students.guardianId, ids))
    : [];

  return (
    <>
      <PageHeader
        title="Parents"
        subtitle="A parent login is created automatically when you enter a guardian's mobile number for a student. Parents sign in with that mobile number."
      />
      {parents.length === 0 ? (
        <Empty>No parents yet. Add a student with the guardian&apos;s mobile number and their login will appear here.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className="th">Parent</th>
              <th className="th">Mobile</th>
              <th className="th">ID card (CNIC)</th>
              <th className="th">Children</th>
              <th className="th">Password</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border align-top">
            {parents.map((p) => {
              const children = kids.filter((k) => k.guardianId === p.id);
              const info = summarizeParent(p, children);
              const canReveal = !!p.initialPasswordEnc;
              return (
                <tr key={p.id}>
                  <td className="td">
                    <p className="font-medium">{p.name}</p>
                    {!isAutoParentEmail(p.email) && <p className="break-all text-xs text-muted">{p.email}</p>}
                    <Link href={`/parents/${p.id}`} className="mt-1 inline-block text-xs text-brand hover:underline">View details</Link>
                  </td>
                  <td className="td whitespace-nowrap">
                    {info.mobile ? (
                      <>
                        <a href={telHref(info.mobile)} className="hover:underline">{formatPkMobile(info.mobile)}</a>
                        {p.phone && <span className="block text-xs text-muted">login</span>}
                      </>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="td whitespace-nowrap">
                    {info.cnics.length === 0 ? <span className="text-muted">—</span> : (
                      <ul className="space-y-0.5">{info.cnics.map((c) => <li key={c} className="tabular-nums">{c}</li>)}</ul>
                    )}
                    {info.cnicConflict && <Badge tone="warn">Differs between children</Badge>}
                  </td>
                  <td className="td">
                    {children.length === 0 ? <span className="text-muted">None linked</span> : (
                      <ul className="space-y-0.5">
                        {children.map((c) => (
                          <li key={c.id}>
                            <Link href={`/students/${c.id}`} className="hover:underline">{c.name}</Link>
                            {c.cls && <span className="text-xs text-muted"> · {c.cls}-{c.section}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="td">
                    {canReveal ? <Badge tone="warn">Initial password, not yet changed</Badge> : <Badge tone="good">Set by parent</Badge>}
                  </td>
                  <td className="td">
                    <div className="flex min-w-48 flex-col items-end gap-2">
                      {canReveal && <RevealButton id={p.id} />}
                      <ResetButton id={p.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <p className="mt-3 max-w-3xl text-xs text-muted">
        For security the first password is stored encrypted and is shown only to administrators, only on request, and it is erased as soon as the parent chooses their own password. Each time it is viewed or reset it is recorded in the audit log.
      </p>
    </>
  );
}
