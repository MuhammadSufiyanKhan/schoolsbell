import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/roles";
import { formatPkMobile } from "@/lib/pk";
import { Badge, PageHeader } from "@/components/ui";
import { canEditStaff } from "@/lib/permissions";
import { StaffEditForm } from "./edit-form";

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser(["admin"]);
  const { id } = await params;
  const [target] = await db.select().from(schema.users).where(and(eq(schema.users.id, Number(id)), eq(schema.users.schoolId, me.schoolId))).limit(1);
  if (!target || target.role === "student" || target.role === "parent" || !canEditStaff(me, target)) notFound();

  const [subjects, assigned] = await Promise.all([
    db.select({ name: schema.subjects.name }).from(schema.subjects).where(eq(schema.subjects.schoolId, me.schoolId)),
    db
      .select({ subject: schema.subjects.name, cls: schema.classes.name, section: schema.classes.section })
      .from(schema.subjects)
      .innerJoin(schema.classes, eq(schema.classes.id, schema.subjects.classId))
      .where(and(eq(schema.subjects.schoolId, me.schoolId), eq(schema.subjects.teacherId, target.id))),
  ]);
  const suggestions = [...new Set(subjects.map((s) => s.name))].sort();

  return (
    <>
      <Link href="/people" className="mb-3 inline-block text-sm text-muted hover:text-foreground">← People</Link>
      <PageHeader title={target.name} subtitle={`${target.isOwner ? "Principal" : ROLE_LABEL[target.role]} · ${target.email}`} />
      <section className="card max-w-2xl">
        <h2 className="mb-4 font-semibold">Profile</h2>
        <StaffEditForm
          initial={{ id: target.id, name: target.name, phone: formatPkMobile(target.phone), cnic: target.cnic ?? "", specializations: target.specializations.join(", ") }}
          suggestions={suggestions}
        />
      </section>

      {target.role === "teacher" && (
        <section className="mt-8 max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold">Currently teaching</h2>
          {assigned.length === 0 ? (
            <p className="card text-sm text-muted">Not assigned to any subject yet. Assign them under Classes.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assigned.map((a, i) => <Badge key={i} tone="neutral">{a.subject} · {a.cls}-{a.section}</Badge>)}
            </div>
          )}
        </section>
      )}
    </>
  );
}
