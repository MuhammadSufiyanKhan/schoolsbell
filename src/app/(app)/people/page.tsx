import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/roles";
import { Badge, PageHeader, Table } from "@/components/ui";
import { formatPkMobile } from "@/lib/pk";
import { isAutoParentEmail } from "@/lib/parents";
import { changeRole } from "./actions";
import { CreateUserForm, ResetPasswordButton } from "./forms";

export default async function PeoplePage() {
  const me = await requireUser(["admin"]);
  const [users, classes, students, subjectRows] = await Promise.all([
    db.select().from(schema.users).where(eq(schema.users.schoolId, me.schoolId)).orderBy(schema.users.role, schema.users.name),
    db.select().from(schema.classes).where(eq(schema.classes.schoolId, me.schoolId)).orderBy(schema.classes.name),
    db.select().from(schema.students).where(eq(schema.students.schoolId, me.schoolId)).orderBy(schema.students.name),
    db.select({ name: schema.subjects.name }).from(schema.subjects).where(eq(schema.subjects.schoolId, me.schoolId)),
  ]);
  const suggestions = [...new Set(subjectRows.map((s) => s.name))].sort();

  return (
    <>
      <PageHeader
        title="People"
        subtitle={me.isOwner ? "You're the principal: you can add administrators, teachers, students and parents." : "Add teachers, students and parents. Only the principal can add administrators."}
      />
      <div className="grid grid-cols-1 gap-8">
        <CreateUserForm
          classes={classes.map((c) => ({ id: c.id, label: `${c.name}-${c.section}` }))}
          students={students.map((s) => ({ id: s.id, label: `${s.name} (${s.rollNo})` }))}
          canCreateAdmin={me.isOwner}
          suggestions={suggestions}
        />

        <section>
          <h2 className="mb-3 text-sm font-semibold">Everyone ({users.length})</h2>
          <Table>
            <thead>
              <tr><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                const canEditRole = me.isOwner && !u.isOwner && u.id !== me.id && (u.role === "admin" || u.role === "teacher");
                const canReset = !u.isOwner && (me.isOwner || u.role !== "admin");
                return (
                  <tr key={u.id}>
                    <td className="td">
                      <p className="font-medium">{u.name}</p>
                      {u.phone && <p className="text-xs text-muted">{formatPkMobile(u.phone)}</p>}
                      {u.specializations.length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-1">{u.specializations.map((sp) => <Badge key={sp} tone="brand">{sp}</Badge>)}</p>
                      )}
                    </td>
                    <td className="td text-muted">{isAutoParentEmail(u.email) ? "Signs in with mobile number" : u.email}</td>
                    <td className="td">
                      {u.isOwner ? (
                        <Badge tone="brand">Principal</Badge>
                      ) : canEditRole ? (
                        <form action={changeRole} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={u.id} />
                          <select name="role" defaultValue={u.role} className="input !w-auto !py-1 text-xs" aria-label={`Role for ${u.name}`}>
                            <option value="teacher">Teacher</option>
                            <option value="admin">Administrator</option>
                          </select>
                          <button className="btn-ghost !py-1 text-xs">Save</button>
                        </form>
                      ) : (
                        <Badge>{ROLE_LABEL[u.role]}</Badge>
                      )}
                    </td>
                    <td className="td">
                      <div className="flex flex-col items-end gap-2">
                        {u.role === "teacher" && <Link href={`/teachers/${u.id}`} className="text-xs text-brand hover:underline">View profile</Link>}
                        {(u.role === "teacher" || u.id === me.id || (me.isOwner && u.role === "admin")) && (
                          <Link href={`/people/${u.id}`} className="text-xs text-brand hover:underline">Edit details</Link>
                        )}
                        {canReset && <ResetPasswordButton id={u.id} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </section>
      </div>
    </>
  );
}
