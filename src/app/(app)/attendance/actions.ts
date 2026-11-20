"use server";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { visibleStudents } from "@/lib/scope";

const Status = z.enum(["present", "absent", "late", "excused"]);
const Header = z.object({
  classId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function saveAttendance(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const { classId, date } = Header.parse({ classId: form.get("classId"), date: form.get("date") });
  if (date > new Date().toISOString().slice(0, 10)) throw new Error("Cannot mark future attendance");

  // Only students this user is allowed to see, in this class.
  const roster = (await visibleStudents(user)).filter((s) => s.classId === classId);
  const values = roster.flatMap((s) => {
    const parsed = Status.safeParse(form.get(`s_${s.id}`));
    return parsed.success ? [{ studentId: s.id, date, status: parsed.data, markedBy: user.id }] : [];
  });
  if (values.length) {
    await db
      .insert(schema.attendance)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.attendance.studentId, schema.attendance.date],
        set: { status: sql`excluded.status`, markedBy: sql`excluded.marked_by` },
      });
    await db.insert(schema.auditLog).values({
      schoolId: user.schoolId,
      userId: user.id,
      action: "attendance.save",
      detail: `class ${classId} on ${date}: ${values.length} records`,
    });
  }
  redirect(`/attendance?class=${classId}&date=${date}&saved=1`);
}
