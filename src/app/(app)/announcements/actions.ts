"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const Input = z.object({
  title: z.string().trim().min(1).max(150),
  body: z.string().trim().min(1).max(4000),
  audience: z.enum(["all", "teachers", "students", "parents"]),
});

export async function postAnnouncement(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const data = Input.parse(Object.fromEntries(form));
  await db.insert(schema.announcements).values({ ...data, schoolId: user.schoolId, authorId: user.id });
  revalidatePath("/announcements");
  revalidatePath("/dashboard");
}
