import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/roles";
import { Badge, PageHeader, Table } from "@/components/ui";
import { changeRole } from "./actions";
import { CreateUserForm, ResetPasswordButton } from "./forms";

export default async function PeoplePage() {
  const me = await requireUser(["admin"]);
  const [users, classes, students] = await Promise.all([
    db.select().from(schema.users).where(eq(schema.users.schoolId, me.schoolId)).orderBy(schema.users.role, schema.users.name),
    db.select().from(schema.classes).where(eq(schema.classes.schoolId, me.schoolId)).orderBy(schema.classes.name),
    db.select().from(schema.students).where(eq(schema.students.schoolId, me.schoolId)).orderBy(schema.students.name),
  ]);

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
                    <td className="td font-medium">{u.name}</td>
                    <td className="td text-muted">{u.email}</td>
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
                    <td className="td">{canReset && <ResetPasswordButton id={u.id} />}</td>
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
