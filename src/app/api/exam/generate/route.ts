import { aiErrorMessage, classifyAiError, type AiFailure } from "@/lib/ai";
import { generateExam } from "@/lib/ai-exam";
import { jsonResponse, staffOnly } from "@/lib/api-guard";
import { ExamRequest } from "@/lib/exam-types";
import { LessonError, readLessons } from "@/lib/lesson-source";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

const STATUS: Record<AiFailure, number> = { not_configured: 503, billing: 503, auth: 503, model: 503, rate_limit: 429, overloaded: 503, timeout: 504, empty: 502, unknown: 502 };

export async function POST(req: Request) {
  const user = await staffOnly(req, "generate tests");
  if (user instanceof Response) return user;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonResponse({ error: "Bad request." }, 400);
  }

  const parsed = ExamRequest.safeParse(Object.fromEntries([...form].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return jsonResponse({ error: parsed.error.issues[0]?.message ?? "Please check the form." }, 400);

  const files = form.getAll("lesson").filter((f): f is File => f instanceof File && f.size > 0);
  const hasFile = files.length > 0;
  if (!hasFile && !parsed.data.prompt) return jsonResponse({ error: "Describe the test you want, or upload a lesson (PDF or photo)." }, 400);

  let lesson = null;
  if (hasFile) {
    try {
      lesson = await readLessons(files, parsed.data.pages);
    } catch (e) {
      if (e instanceof LessonError) return jsonResponse({ error: e.message }, 400);
      console.error("[exam] could not read upload:", e instanceof Error ? e.name : "error");
      return jsonResponse({ error: "That file couldn't be read. Please try a different PDF or image." }, 400);
    }
  }

  try {
    const exam = await generateExam(parsed.data, lesson);
    return jsonResponse(
      {
        exam,
        notice: lesson?.truncated ? "The lesson was long, so only the first part was used. Choose a page range to cover the rest." : null,
      },
      200,
    );
  } catch (e) {
    const kind = classifyAiError(e);
    return jsonResponse({ error: aiErrorMessage(e), kind }, STATUS[kind]);
  }
}
