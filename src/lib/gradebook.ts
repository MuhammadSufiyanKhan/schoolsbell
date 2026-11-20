import "server-only";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { today } from "./analytics";

/** Create the gradebook entry an assignment/test reports into. */
export async function createAssessment(subjectId: number, title: string, maxScore: number) {
  const [a] = await db
    .insert(schema.assessments)
    .values({ subjectId, title, maxScore, weight: 1, date: today() })
    .returning();
  return a.id;
}

/** Write (or update) a student's score in the gradebook so averages and the dashboard stay in sync. */
export async function syncGrade(assessmentId: number | null, studentId: number, score: number) {
  if (!assessmentId) return;
  await db
    .insert(schema.grades)
    .values({ assessmentId, studentId, score })
    .onConflictDoUpdate({
      target: [schema.grades.assessmentId, schema.grades.studentId],
      set: { score: sql`excluded.score` },
    });
}
