import { totalMarks, type Exam, type PaperMeta } from "./exam-types";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/** Keep line breaks the model wrote, escaped. */
const para = (s: string) => esc(s).replace(/\r?\n/g, "<br>");
const num = (n: number) => String(Math.round(n * 2) / 2);
const LETTERS = "ABCDEF";

const SECTION: Record<"mcq" | "short" | "long", { title: string; hint: string; lines: number }> = {
  mcq: { title: "Section A: Multiple choice", hint: "Choose the one correct answer.", lines: 0 },
  short: { title: "Section B: Short answers", hint: "Answer briefly.", lines: 3 },
  long: { title: "Section C: Long answers", hint: "Answer in detail.", lines: 9 },
};

export const hasArabicScript = (s: string) => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(s);

/**
 * The printable paper. Everything dynamic is HTML-escaped; the page has no scripts and loads nothing from the network.
 * `arabicFontCss` is an optional @font-face block (base64) for Urdu/Arabic text.
 */
export function renderExamHtml(exam: Exam, meta: PaperMeta, variant: "student" | "teacher", school: string, arabicFontCss = ""): string {
  const teacher = variant === "teacher";
  let n = 0;
  const body: string[] = [];
  for (const kind of ["mcq", "short", "long"] as const) {
    const qs = exam.questions.filter((q) => q.kind === kind);
    if (!qs.length) continue;
    const sec = SECTION[kind];
    const secMarks = qs.reduce((s, q) => s + q.marks, 0);
    body.push(`<section><h2><span>${sec.title}</span><span class="marks">${num(secMarks)} marks</span></h2><p class="hint">${sec.hint}</p>`);
    for (const q of qs) {
      n++;
      body.push(`<div class="q"><div class="qhead"><span class="qn">${n}.</span><div class="qtext" dir="auto">${para(q.prompt)}</div><span class="marks">[${num(q.marks)}]</span></div>`);
      if (kind === "mcq" && q.options) {
        body.push('<ol class="opts">');
        q.options.forEach((o, i) => {
          const right = teacher && i === q.correctIndex;
          body.push(`<li class="${right ? "right" : ""}"><span class="ltr">${LETTERS[i]}</span><span dir="auto">${esc(o)}</span>${right ? '<span class="tick" aria-hidden="true"> ✓</span>' : ""}</li>`);
        });
        body.push("</ol>");
      } else if (!teacher) {
        body.push(`<div class="lines">${'<div class="line"></div>'.repeat(sec.lines)}</div>`);
      }
      if (teacher && kind !== "mcq") body.push(`<div class="answer"><b>Marking guide:</b> <span dir="auto">${q.answer ? para(q.answer) : "—"}</span></div>`);
      body.push("</div>");
    }
    body.push("</section>");
  }

  const key = teacher
    ? `<section class="key"><h2><span>Answer key (multiple choice)</span></h2><p>${
        exam.questions
          .filter((q) => q.kind === "mcq")
          .map((q, i) => `<b>${i + 1}</b>&nbsp;${LETTERS[q.correctIndex ?? 0]}`)
          .join(" &nbsp;·&nbsp; ") || "No multiple-choice questions."
      }</p></section>`
    : "";

  const info = [
    meta.subject && `<div><b>Subject:</b> ${esc(meta.subject)}</div>`,
    meta.grade && `<div><b>Class:</b> ${esc(meta.grade)}</div>`,
    meta.duration && `<div><b>Time:</b> ${esc(meta.duration)}</div>`,
    meta.date && `<div><b>Date:</b> ${esc(meta.date)}</div>`,
    `<div><b>Total marks:</b> ${num(totalMarks(exam))}</div>`,
  ].filter(Boolean).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(exam.title)}</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:">
<style>
${arabicFontCss}
@page { size: A4; margin: 18mm 16mm 20mm; }
* { box-sizing: border-box; }
body { font-family: "DejaVu Sans", "Open Sans", "Noto Sans", "Noto Naskh Arabic", Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111; margin: 0; }
[dir=auto] { unicode-bidi: plaintext; }
header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
header .school { font-size: 10pt; letter-spacing: .08em; text-transform: uppercase; }
header h1 { font-size: 17pt; margin: 2px 0 6px; }
.badge { display: inline-block; border: 1.5px solid #111; padding: 1px 8px; font-size: 9pt; font-weight: 700; letter-spacing: .06em; margin-bottom: 6px; }
.info { display: flex; flex-wrap: wrap; gap: 4px 22px; justify-content: center; font-size: 10pt; }
.student { display: flex; gap: 24px; margin: 12px 0 4px; font-size: 10pt; }
.student div { flex: 1; border-bottom: 1px solid #111; padding-bottom: 14px; }
.instr { margin: 10px 0 4px; padding: 6px 10px; background: #f1f1f1; border-left: 3px solid #111; font-size: 10pt; }
h2 { display: flex; justify-content: space-between; font-size: 12pt; margin: 16px 0 0; padding-bottom: 3px; border-bottom: 1px solid #888; break-after: avoid; }
.hint { margin: 3px 0 8px; font-size: 9.5pt; color: #444; font-style: italic; }
.q { margin: 0 0 11px; break-inside: avoid; }
.qhead { display: flex; gap: 6px; align-items: flex-start; }
.qn { font-weight: 700; min-width: 22px; }
.qtext { flex: 1; }
.marks { white-space: nowrap; font-weight: 600; font-size: 10pt; }
.opts { list-style: none; margin: 4px 0 0 28px; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 18px; }
.opts li { display: flex; gap: 6px; }
.ltr { font-weight: 700; min-width: 16px; }
.opts li.right { font-weight: 700; }
.tick { color: #0a7a2f; }
.lines { margin: 6px 0 0 28px; }
.line { border-bottom: 1px solid #999; height: 22px; }
.answer { margin: 5px 0 0 28px; padding: 5px 9px; background: #eaf6ee; border-left: 3px solid #0a7a2f; font-size: 10pt; }
.key { margin-top: 18px; break-inside: avoid; }
.key p { font-size: 11pt; }
</style></head><body>
<header>
${school ? `<div class="school">${esc(school)}</div>` : ""}
<h1 dir="auto">${esc(exam.title)}</h1>
${teacher ? '<div class="badge">TEACHER COPY: ANSWER KEY</div>' : ""}
<div class="info">${info}</div>
</header>
${teacher ? "" : '<div class="student"><div>Name:</div><div>Roll no.:</div></div>'}
${exam.instructions ? `<div class="instr" dir="auto"><b>Instructions:</b> ${para(exam.instructions)}</div>` : ""}
${body.join("\n")}
${key}
</body></html>`;
}
