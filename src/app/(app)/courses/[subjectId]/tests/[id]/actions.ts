"use server";
import { redirect } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { createAssessment, requireCourseForAction } from "@/lib/lms";
import { aiErrorCode } from "@/lib/ai";
import { aiGradeAttempts, markMcq, releaseAttempt, sumPoints } from "@/lib/tests";

const base = z.object({ subjectId: z.coerce.number().int(), testId: z.coerce.number().int() });

async function loadTest(subjectId: number, testId: number) {
  const [t] = await db.select().from(schema.tests).where(and(eq(schema.tests.id, testId), eq(schema.tests.subjectId, subjectId))).limit(1);
  if (!t) throw new Error("Test not found");
  return t;
}
const testUrl = (s: number, t: number) => `/courses/${s}/tests/${t}`;

// ───────────────────────── Question editing (teachers, drafts only) ─────────────────────────

const points = z.coerce.number().min(0.5).max(20);

function parseQuestion(form: FormData, kind: "mcq" | "short") {
  const prompt = z.string().trim().min(1, "Write the question.").max(2000).parse(form.get("prompt"));
  const pts = points.parse(form.get("points"));
  if (kind === "short") {
    const modelAnswer = z.string().trim().max(2000).parse(form.get("modelAnswer") ?? "");
    return { kind, prompt, points: pts, options: null, correctIndex: null, modelAnswer: modelAnswer || null } as const;
  }
  const raw = form.getAll("opt").map((v) => String(v).trim());
  const correctRaw = Number(form.get("correctIndex"));
  const kept: string[] = [];
  let correctIndex = -1;
  raw.forEach((o, i) => {
    if (!o) return;
    if (i === correctRaw) correctIndex = kept.length;
    kept.push(o.slice(0, 500));
  });
  if (kept.length < 2) throw new Error("Give at least two options.");
  if (correctIndex < 0) throw new Error("Pick which option is correct (and fill it in).");
  return { kind, prompt, points: pts, options: kept, correctIndex, modelAnswer: null } as const;
}

async function assertDraft(subjectId: number, testId: number, user: Awaited<ReturnType<typeof requireUser>>) {
  await requireCourseForAction(user, subjectId);
  const t = await loadTest(subjectId, testId);
  if (t.published) throw new Error("Unpublish the test before editing its questions.");
  return t;
}

export async function addQuestion(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const d = base.extend({ kind: z.enum(["mcq", "short"]) }).parse(Object.fromEntries(form));
  await assertDraft(d.subjectId, d.testId, user);
  const q = parseQuestion(form, d.kind);
  const [{ n }] = await db.select({ n: count() }).from(schema.testQuestions).where(eq(schema.testQuestions.testId, d.testId));
  await db.insert(schema.testQuestions).values({ testId: d.testId, position: n, ...q });
  redirect(testUrl(d.subjectId, d.testId));
}

export async function saveQuestion(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const d = base.extend({ questionId: z.coerce.number().int() }).parse(Object.fromEntries(form));
  await assertDraft(d.subjectId, d.testId, user);
  const [existing] = await db.select().from(schema.testQuestions).where(and(eq(schema.testQuestions.id, d.questionId), eq(schema.testQuestions.testId, d.testId))).limit(1);
  if (!existing) throw new Error("Question not found");
  const q = parseQuestion(form, existing.kind);
  await db.update(schema.testQuestions).set(q).where(eq(schema.testQuestions.id, existing.id));
  redirect(testUrl(d.subjectId, d.testId) + "?saved=1");
}

export async function deleteQuestion(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const d = base.extend({ questionId: z.coerce.number().int() }).parse(Object.fromEntries(form));
  await assertDraft(d.subjectId, d.testId, user);
  await db.delete(schema.testQuestions).where(and(eq(schema.testQuestions.id, d.questionId), eq(schema.testQuestions.testId, d.testId)));
  redirect(testUrl(d.subjectId, d.testId));
}

export async function updateTestDetails(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const d = base.extend({ title: z.string().trim().min(1).max(150), instructions: z.string().trim().max(1000).optional() }).parse(Object.fromEntries(form));
  await assertDraft(d.subjectId, d.testId, user);
  await db.update(schema.tests).set({ title: d.title, instructions: d.instructions || null }).where(eq(schema.tests.id, d.testId));
  redirect(testUrl(d.subjectId, d.testId) + "?saved=1");
}

// ───────────────────────── Publishing ─────────────────────────

export async function setPublished(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const d = base.extend({ publish: z.enum(["1", "0"]) }).parse(Object.fromEntries(form));
  await requireCourseForAction(user, d.subjectId);
  const test = await loadTest(d.subjectId, d.testId);
  const back = testUrl(d.subjectId, d.testId);

  if (d.publish === "0") {
    const [{ n }] = await db.select({ n: count() }).from(schema.testAttempts).where(eq(schema.testAttempts.testId, d.testId));
    if (n > 0) redirect(back + "?error=has_attempts");
    await db.update(schema.tests).set({ published: false }).where(eq(schema.tests.id, d.testId));
    redirect(back);
  }

  const qs = await db.select().from(schema.testQuestions).where(eq(schema.testQuestions.testId, d.testId));
  if (!qs.length) redirect(back + "?error=no_questions");
  const total = sumPoints(qs);
  let assessmentId = test.assessmentId;
  if (assessmentId) {
    await db.update(schema.assessments).set({ maxScore: total, title: test.title }).where(eq(schema.assessments.id, assessmentId));
  } else {
    assessmentId = await createAssessment(d.subjectId, test.title, total);
  }
  await db.update(schema.tests).set({ published: true, assessmentId }).where(eq(schema.tests.id, d.testId));
  await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "test.publish", detail: `test ${d.testId}` });
  redirect(back + "?published=1");
}

// ───────────────────────── Student attempt ─────────────────────────

export async function submitAttempt(form: FormData) {
  const user = await requireUser(["student"]);
  const d = base.parse(Object.fromEntries(form));
  const access = await requireCourseForAction(user, d.subjectId, "any");
  if (access.mode !== "learn" || !access.student) throw new Error("Not allowed");
  const test = await loadTest(d.subjectId, d.testId);
  if (!test.published) throw new Error("This test isn't open.");

  const [already] = await db.select().from(schema.testAttempts).where(and(eq(schema.testAttempts.testId, test.id), eq(schema.testAttempts.studentId, access.student.id))).limit(1);
  if (already) redirect(testUrl(d.subjectId, d.testId));

  const questions = await db.select().from(schema.testQuestions).where(eq(schema.testQuestions.testId, test.id)).orderBy(schema.testQuestions.position);
  const [attempt] = await db.insert(schema.testAttempts).values({ testId: test.id, studentId: access.student.id }).returning();
  try {
    const rows = questions.map((q) => {
      const raw = form.get(`q_${q.id}`);
      if (q.kind === "mcq") {
        const idx = raw === null || raw === "" ? null : Number(raw);
        const selectedIndex = idx != null && Number.isInteger(idx) && idx >= 0 && idx < (q.options?.length ?? 0) ? idx : null;
        return { attemptId: attempt.id, questionId: q.id, selectedIndex, answerText: null, score: markMcq(q, selectedIndex) };
      }
      return { attemptId: attempt.id, questionId: q.id, selectedIndex: null, answerText: String(raw ?? "").slice(0, 4000), score: null };
    });
    if (rows.length) await db.insert(schema.testAnswers).values(rows);
  } catch (e) {
    // Don't leave a half-saved attempt that would block a retry.
    await db.delete(schema.testAttempts).where(eq(schema.testAttempts.id, attempt.id));
    throw e;
  }

  // All multiple choice? Mark and release instantly. Otherwise it waits for the teacher (optionally AI-assisted).
  if (questions.every((q) => q.kind === "mcq")) await releaseAttempt(attempt.id);
  redirect(testUrl(d.subjectId, d.testId) + "?submitted=1");
}

// ───────────────────────── AI grading (teachers) ─────────────────────────

export async function aiGradeAll(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const d = base.parse(Object.fromEntries(form));
  await requireCourseForAction(user, d.subjectId);
  await loadTest(d.subjectId, d.testId);
  const pending = await db.select({ id: schema.testAttempts.id }).from(schema.testAttempts).where(and(eq(schema.testAttempts.testId, d.testId), eq(schema.testAttempts.status, "submitted")));
  const back = testUrl(d.subjectId, d.testId);
  if (!pending.length) redirect(back + "?error=ai_empty");
  let result: string;
  try {
    const n = await aiGradeAttempts(d.testId, pending.map((p) => p.id));
    await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "test.ai_grade", detail: `test ${d.testId}: ${n} answers` });
    result = `?aigraded=${n}`;
  } catch (e) {
    result = `?error=${aiErrorCode(e)}`;
  }
  redirect(back + result);
}
