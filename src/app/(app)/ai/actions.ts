"use server";
import { generateText } from "ai";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { visibleStudents } from "@/lib/scope";
import { attendanceRates, gradeAverages } from "@/lib/analytics";

export type AiState = { text?: string; error?: string };

// Routed through Vercel AI Gateway: plain "provider/model" string, swap via env without code changes.
const MODEL = process.env.AI_MODEL ?? "anthropic/claude-sonnet-4.6";

const SYSTEM =
  "You are an assistant for school teachers. Produce practical, classroom-ready, age-appropriate output. " +
  "Be concise, use clear headings and bullet points, and never invent facts about real students. " +
  "Everything you write is a DRAFT that the teacher will review.";

async function run(prompt: string): Promise<AiState> {
  // On Vercel the AI Gateway authenticates via OIDC automatically; elsewhere a key is needed.
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL) {
    return { error: "AI is not configured. Set AI_GATEWAY_API_KEY (or deploy on Vercel with AI Gateway enabled)." };
  }
  try {
    const { text } = await generateText({ model: MODEL, instructions: SYSTEM, prompt });
    return { text };
  } catch (e) {
    console.error("AI error", e);
    return { error: "The AI service couldn't complete that request. Please try again." };
  }
}

const Lesson = z.object({ grade: z.string().min(1).max(40), subject: z.string().min(1).max(60), topic: z.string().min(1).max(200), minutes: z.coerce.number().int().min(10).max(180) });
export async function lessonPlan(_p: AiState | undefined, form: FormData): Promise<AiState> {
  await requireUser(["admin", "teacher"]);
  const d = Lesson.safeParse(Object.fromEntries(form));
  if (!d.success) return { error: "Please fill in every field." };
  return run(`Create a ${d.data.minutes}-minute lesson plan for ${d.data.grade} ${d.data.subject} on "${d.data.topic}". Include: learning objectives, materials, a timed activity sequence (hook, instruction, practice, check for understanding), differentiation for struggling and advanced learners, and a 3-question exit ticket.`);
}

const Quiz = z.object({ grade: z.string().min(1).max(40), topic: z.string().min(1).max(200), count: z.coerce.number().int().min(3).max(20), kind: z.enum(["multiple choice", "short answer", "mixed"]) });
export async function quiz(_p: AiState | undefined, form: FormData): Promise<AiState> {
  await requireUser(["admin", "teacher"]);
  const d = Quiz.safeParse(Object.fromEntries(form));
  if (!d.success) return { error: "Please fill in every field." };
  return run(`Write a ${d.data.count}-question ${d.data.kind} quiz for ${d.data.grade} on "${d.data.topic}". Order questions from easy to hard. After the quiz, give an answer key and, for short-answer questions, a brief marking rubric.`);
}

const Comment = z.object({ studentId: z.coerce.number().int(), tone: z.enum(["warm and encouraging", "formal", "constructive and direct"]) });
export async function reportComment(_p: AiState | undefined, form: FormData): Promise<AiState> {
  const user = await requireUser(["admin", "teacher"]);
  const d = Comment.safeParse(Object.fromEntries(form));
  if (!d.success) return { error: "Please choose a student." };
  const student = (await visibleStudents(user)).find((s) => s.id === d.data.studentId);
  if (!student) return { error: "Student not found." };
  const [att, grade] = await Promise.all([attendanceRates([student.id]), gradeAverages([student.id])]);
  // Privacy: send only the FIRST NAME and aggregate numbers — no surname, roll no, DOB or IDs.
  const first = student.name.split(" ")[0];
  return run(`Write a ${d.data.tone} end-of-term report card comment (60-90 words) for ${first}. Facts: attendance over the last 4 weeks ${att.get(student.id)?.rate ?? "unknown"}%; overall grade average ${grade.get(student.id) ?? "unknown"}%. Mention one strength and one concrete next step. Do not invent anecdotes.`);
}

const Msg = z.object({ situation: z.string().min(5).max(800), tone: z.enum(["friendly", "formal", "urgent but kind"]), language: z.string().min(2).max(40) });
export async function parentMessage(_p: AiState | undefined, form: FormData): Promise<AiState> {
  await requireUser(["admin", "teacher"]);
  const d = Msg.safeParse(Object.fromEntries(form));
  if (!d.success) return { error: "Describe the situation (at least a few words)." };
  return run(`Draft a short ${d.data.tone} message to a parent in ${d.data.language}. Situation: ${d.data.situation}. Do not include any student's full name; use [Student] as a placeholder. End with a clear next step.`);
}
