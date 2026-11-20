"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const Input = z.object({
  name: z.string().trim().min(2).max(120),
  rollNo: z.string().trim().min(1).max(30),
  classId: z.coerce.number().int().positive(),
  dob: z.string().optional(),
});

export async function addStudent(form: FormData) {
  const user = await requireUser(["admin"]);
  const data = Input.parse(Object.fromEntries(form));
  await db.insert(schema.students).values({
    schoolId: user.schoolId,
    name: data.name,
    rollNo: data.rollNo,
    classId: data.classId,
    dob: data.dob || null,
  });
  await db.insert(schema.auditLog).values({
    schoolId: user.schoolId,
    userId: user.id,
    action: "student.create",
    detail: `${data.name} (${data.rollNo})`,
  });
  revalidatePath("/students");
}
