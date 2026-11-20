"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { requireCourseForAction, syncGrade, clampScore } from "@/lib/lms";
import { aiErrorCode, gradeAnswers } from "@/lib/ai";

const ids = z.object({ subjectId: z.coerce.number().int(), assignmentId: z.coerce.number().int() });

async function loadAssignment(subjectId: number, assignmentId: number) {
  const [a] = await db.select().from(schema.assignments).where(and(eq(schema.assignments.id, assignmentId), eq(schema.assignments.subjectId, subjectId))).limit(1);
  if (!a) throw new Error("Assignment not found");
  return a;
}

export async function submitAssignment(form: FormData) {
  const user = await requireUser(["student"]);
  const d = ids.extend({ answer: z.string().trim().min(1, "Write your answer first.").max(8000) }).parse(Object.fromEntries(form));
  const access = await requireCourseForAction(user, d.subjectId, "any");
  if (access.mode !== "learn" || !access.student) throw new Error("Not allowed");
  await loadAssignment(d.subjectId, d.assignmentId);

  const [existing] = await db
    .select()
    .from(schema.submissions)
    .where(and(eq(schema.submissions.assignmentId, d.assignmentId), eq(schema.submissions.studentId, access.student.id)))
    .limit(1);
  if (existing?.gradedAt) throw new Error("This submission has already been graded.");

  // Resubmitting replaces the answer and clears any un-released AI suggestion.
  await db
    .insert(schema.submissions)
    .values({ assignmentId: d.assignmentId, studentId: access.student.id, answer: d.answer })
    .onConflictDoUpdate({
      target: [schema.submissions.assignmentId, schema.submissions.studentId],
      set: { answer: d.answer, submittedAt: new Date(), score: null, feedback: null, aiAssisted: false },
    });
  redirect(`/courses/${d.subjectId}/assignments/${d.assignmentId}?submitted=1`);
}

export async function gradeSubmission(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const d = ids
    .extend({
      submissionId: z.coerce.number().int(),
      score: z.coerce.number().min(0),
      feedback: z.string().trim().max(2000).optional(),
    })
    .parse(Object.fromEntries(form));
  await requireCourseForAction(user, d.subjectId);
  const assignment = await loadAssignment(d.subjectId, d.assignmentId);
  if (d.score > assignment.maxScore) throw new Error(`Score can't exceed ${assignment.maxScore}.`);

  const [sub] = await db.select().from(schema.submissions).where(and(eq(schema.submissions.id, d.submissionId), eq(schema.submissions.assignmentId, d.assignmentId))).limit(1);
  if (!sub) throw new Error("Submission not found");

  await db.update(schema.submissions).set({ score: d.score, feedback: d.feedback || null, gradedAt: new Date() }).where(eq(schema.submissions.id, sub.id));
  await syncGrade(assignment.assessmentId, sub.studentId, d.score);
  await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "assignment.grade", detail: `submission ${sub.id}: ${d.score}/${assignment.maxScore}${sub.aiAssisted ? " (AI-assisted)" : ""}` });
  revalidatePath(`/courses/${d.subjectId}/assignments/${d.assignmentId}`);
  redirect(`/courses/${d.subjectId}/assignments/${d.assignmentId}?saved=1`);
}

/** Stores an AI *suggestion* (not released): the student sees nothing until the teacher saves the grade. */
export async function suggestWithAi(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const d = ids.extend({ submissionId: z.coerce.number().int() }).parse(Object.fromEntries(form));
  await requireCourseForAction(user, d.subjectId);
  const assignment = await loadAssignment(d.subjectId, d.assignmentId);
  const [sub] = await db.select().from(schema.submissions).where(and(eq(schema.submissions.id, d.submissionId), eq(schema.submissions.assignmentId, d.assignmentId))).limit(1);
  if (!sub) throw new Error("Submission not found");

  const back = `/courses/${d.subjectId}/assignments/${d.assignmentId}`;
  let notice: string;
  try {
    // Only the answer text is sent: no student name or ID.
    const res = await gradeAnswers([{ id: sub.id, question: `${assignment.title}\n${assignment.instructions}`, reference: null, maxPoints: assignment.maxScore, answer: sub.answer }]);
    const r = res.get(sub.id);
    if (!r) {
      notice = "ai_failed";
    } else {
      await db.update(schema.submissions).set({ score: clampScore(r.score, assignment.maxScore), feedback: r.feedback, aiAssisted: true }).where(eq(schema.submissions.id, sub.id));
      notice = "";
    }
  } catch (e) {
    notice = aiErrorCode(e);
  }
  redirect(notice ? `${back}?error=${notice}` : `${back}?suggested=${sub.id}`);
}
