import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { formatPkMobile, telHref } from "@/lib/pk";
import { isAutoParentEmail } from "@/lib/parents";
import { summarizeParent } from "@/lib/parent-details";
import { Badge, PageHeader, Table } from "@/components/ui";
import { RevealButton, ResetButton } from "../credential-buttons";
import { idParam } from "@/lib/ids";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function ParentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser(["admin"]);
  const { id } = await params;
  // Scoped to the caller's school: another school's parent is a 404, not a 403.
  const [parent] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.id, idParam(id)), eq(schema.users.schoolId, me.schoolId), eq(schema.users.role, "parent")))
    .limit(1);
  if (!parent) notFound();

  const kids = await db
    .select({
      id: schema.students.id,
      name: schema.students.name,
      rollNo: schema.students.rollNo,
      guardianName: schema.students.guardianName,
      guardianPhone: schema.students.guardianPhone,
      guardianCnic: schema.students.guardianCnic,
      cls: schema.classes.name,
      section: schema.classes.section,
    })
    .from(schema.students)
    .leftJoin(schema.classes, eq(schema.classes.id, schema.students.classId))
    .where(and(eq(schema.students.guardianId, parent.id), eq(schema.students.schoolId, me.schoolId)))
    .orderBy(schema.students.name);

  const info = summarizeParent(parent, kids);
  const auto = isAutoParentEmail(parent.email);
  const canReveal = !!parent.initialPasswordEnc;
  const none = <span className="text-muted">Not recorded</span>;

  return (
    <>
      <Link href="/parents" className="mb-3 inline-block text-sm text-muted hover:text-foreground">← Parents</Link>
      <PageHeader title={parent.name} subtitle={`Parent · ${kids.length} ${kids.length === 1 ? "child" : "children"}`} />

      {(info.cnicConflict || info.phoneConflict) && (
        <p role="alert" className="mb-4 max-w-3xl rounded-lg bg-warn-soft px-4 py-2 text-sm text-warn">
          {info.cnicConflict && "Different ID card numbers are recorded across this parent's children. "}
          {info.phoneConflict && "A child records a different guardian mobile than this parent's login. "}
          Check the guardian details on each child below and correct whichever is wrong.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold">Contact &amp; identity</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Row label="Name">{parent.name}</Row>
            <Row label="Mobile">
              {info.mobile ? <a href={telHref(info.mobile)} className="text-brand hover:underline">{formatPkMobile(info.mobile)}</a> : none}
            </Row>
            <Row label="ID card (CNIC)">
              {info.cnics.length === 0 ? none : <ul className="space-y-0.5">{info.cnics.map((c) => <li key={c} className="tabular-nums">{c}</li>)}</ul>}
            </Row>
            <Row label="Guardian name on file">{info.names.length ? info.names.join(" / ") : none}</Row>
            <Row label="Signs in with">{auto ? `Mobile number ${formatPkMobile(parent.phone)}` : <span className="break-all">{parent.email}</span>}</Row>
            <Row label="Account created">{parent.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</Row>
          </dl>
        </section>

        <section className="card">
          <h2 className="mb-4 text-sm font-semibold">Login</h2>
          <div className="mb-3">
            {canReveal ? <Badge tone="warn">Initial password, not yet changed</Badge> : <Badge tone="good">Password set by the parent</Badge>}
          </div>
          <div className="flex flex-wrap items-start gap-3">
            {canReveal && <RevealButton id={parent.id} />}
            <ResetButton id={parent.id} />
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">Children &amp; guardian details as recorded</h2>
        {kids.length === 0 ? (
          <p className="card text-sm text-muted">No children are linked to this parent.</p>
        ) : (
          <Table>
            <thead>
              <tr><th className="th">Child</th><th className="th">Class</th><th className="th">Guardian name</th><th className="th">Mobile</th><th className="th">CNIC</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {kids.map((k) => (
                <tr key={k.id}>
                  <td className="td">
                    <Link href={`/students/${k.id}`} className="font-medium hover:underline">{k.name}</Link>
                    <span className="block text-xs text-muted">Roll {k.rollNo}</span>
                  </td>
                  <td className="td">{k.cls ? `${k.cls}-${k.section}` : "—"}</td>
                  <td className="td">{k.guardianName ?? <span className="text-muted">—</span>}</td>
                  <td className="td whitespace-nowrap">{k.guardianPhone ? formatPkMobile(k.guardianPhone) : <span className="text-muted">—</span>}</td>
                  <td className="td whitespace-nowrap tabular-nums">{k.guardianCnic ?? <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="mt-3 max-w-3xl text-xs text-muted">
          To correct guardian details, open the child and edit the Guardian section. Changing the guardian&apos;s mobile there also updates this parent&apos;s login.
        </p>
      </section>
    </>
  );
}
