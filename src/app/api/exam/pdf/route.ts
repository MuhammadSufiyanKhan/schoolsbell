import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { jsonResponse, staffOnly } from "@/lib/api-guard";
import { PdfRequest } from "@/lib/exam-types";
import { PdfUnavailableError, renderExamPdf } from "@/lib/exam-pdf";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_BODY = 300_000;

const slug = (s: string) => s.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "test";

export async function POST(req: Request) {
  const user = await staffOnly(req, "download tests");
  if (user instanceof Response) return user;

  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return jsonResponse({ error: "Bad request." }, 400);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return jsonResponse({ error: "Bad request." }, 400);
  }
  const parsed = PdfRequest.safeParse(raw);
  if (!parsed.success) return jsonResponse({ error: "That test isn't valid, so it can't be turned into a PDF." }, 400);

  // The school name comes from the signed-in user's own school, never from the request.
  const [school] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, user.schoolId)).limit(1);

  try {
    const { exam, meta, variant } = parsed.data;
    const pdf = await renderExamPdf(exam, meta, variant, school?.name ?? "");
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug(exam.title)}${variant === "teacher" ? "-answer-key" : ""}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[exam] pdf failed:", e instanceof Error ? e.message.slice(0, 200) : "error");
    if (e instanceof PdfUnavailableError) return jsonResponse({ error: "PDF export isn't available on this server. Use Print instead." }, 503);
    return jsonResponse({ error: "The PDF couldn't be created. Please try again, or use Print." }, 500);
  }
}
