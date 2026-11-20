import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { BookOpen } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { Empty, PageHeader } from "@/components/ui";

export default async function CoursesPage() {
  const user = await requireUser(["admin", "teacher", "student"]);
  const { subjects, classes, students } = schema;

  let rows: { subject: typeof subjects.$inferSelect; cls: typeof classes.$inferSelect }[];
  if (user.role === "student") {
    const mine = await db.select({ classId: students.classId }).from(students).where(eq(students.userId, user.id));
    const classIds = mine.flatMap((m) => (m.classId ? [m.classId] : []));
    rows = classIds.length
      ? await db.select({ subject: subjects, cls: classes }).from(subjects).innerJoin(classes, eq(classes.id, subjects.classId)).where(and(eq(subjects.schoolId, user.schoolId), inArray(subjects.classId, classIds)))
      : [];
  } else {
    const base = db.select({ subject: subjects, cls: classes }).from(subjects).innerJoin(classes, eq(classes.id, subjects.classId));
    rows = await (user.role === "admin"
      ? base.where(eq(subjects.schoolId, user.schoolId))
      : base.where(and(eq(subjects.schoolId, user.schoolId), eq(subjects.teacherId, user.id))));
  }
  rows.sort((a, b) => a.cls.name.localeCompare(b.cls.name) || a.subject.name.localeCompare(b.subject.name));

  return (
    <>
      <PageHeader title="Courses" subtitle={user.role === "student" ? "Your classes: materials, assignments and tests." : "Your subjects: share materials, set assignments and run tests."} />
      {rows.length === 0 ? (
        <Empty>
          {user.role === "teacher" ? "No subjects are assigned to you yet. Ask the principal to assign you under Classes." : user.role === "admin" ? "No subjects yet. Create classes and subjects under Classes." : "You're not enrolled in a class yet."}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ subject, cls }) => (
            <Link key={subject.id} href={`/courses/${subject.id}`} className="card block transition hover:border-brand">
              <span className="mb-3 grid size-9 place-items-center rounded-lg bg-brand-soft text-brand"><BookOpen className="size-5" aria-hidden /></span>
              <h2 className="font-semibold">{subject.name}</h2>
              <p className="text-sm text-muted">{cls.name}-{cls.section}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
