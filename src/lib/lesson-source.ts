import { extractText, getDocumentProxy } from "unpdf";

/** A lesson the teacher uploaded: either its text (PDF) or the picture itself (for a vision model). */
export type Lesson =
  | { kind: "text"; text: string; truncated: boolean; pages: number }
  | { kind: "image"; mediaType: "image/png" | "image/jpeg" | "image/webp"; data: Uint8Array };

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Groq accepts at most 4 MB of base64 per image (~3 MB of bytes). */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_LESSON_CHARS = 24_000;
export const MAX_PDF_PAGES = 200;

export class LessonError extends Error {}

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** Decide the type from the file's own bytes, never from its name or the browser-supplied MIME type. */
export function sniff(b: Uint8Array): "pdf" | "png" | "jpeg" | "webp" | null {
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

/** "3", "2-5", "1,3,7-9" → sorted unique page numbers (1-based). Empty string = all pages. */
export function parsePages(spec: string, total: number): number[] | null {
  const s = spec.trim();
  if (!s) return null;
  if (!/^\d+(\s*-\s*\d+)?(\s*,\s*\d+(\s*-\s*\d+)?)*$/.test(s)) throw new LessonError("Page range looks wrong. Use something like 1-3, 5.");
  const out = new Set<number>();
  for (const part of s.split(",")) {
    const [a, b] = part.split("-").map((x) => Number(x.trim()));
    const lo = Math.min(a, b ?? a);
    const hi = Math.max(a, b ?? a);
    for (let p = lo; p <= hi && p <= total; p++) if (p >= 1) out.add(p);
  }
  if (!out.size) throw new LessonError(`That page range is outside the document (it has ${total} page${total === 1 ? "" : "s"}).`);
  return [...out].sort((x, y) => x - y);
}

export async function readLesson(file: File, pageSpec = ""): Promise<Lesson> {
  if (file.size === 0) throw new LessonError("The uploaded file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new LessonError("The file is too large. Please keep it under 8 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) throw new LessonError("Unsupported file. Please upload a PDF, PNG, JPG or WebP.");

  if (type !== "pdf") {
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new LessonError("That image is too large for the AI (limit 3 MB). Please upload a smaller or lower-resolution photo.");
    return { kind: "image", mediaType: type === "png" ? "image/png" : type === "webp" ? "image/webp" : "image/jpeg", data: bytes };
  }

  let pdf;
  try {
    pdf = await getDocumentProxy(bytes);
  } catch {
    throw new LessonError("That PDF couldn't be opened. It may be damaged or password-protected.");
  }
  {
    if (pdf.numPages > MAX_PDF_PAGES) throw new LessonError(`That PDF has ${pdf.numPages} pages. Please upload up to ${MAX_PDF_PAGES}, or just the chapter you need.`);
    const wanted = parsePages(pageSpec, pdf.numPages);
    const { text: pages } = await extractText(pdf, { mergePages: false });
    const chosen = (wanted ?? pages.map((_, i) => i + 1)).map((p) => pages[p - 1] ?? "");
    let text = chosen.map((t) => t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()).filter(Boolean).join("\n\n");
    if (text.replace(/\s/g, "").length < 80) {
      throw new LessonError("This PDF has no readable text (it looks like a scan). Upload photos of the pages as images instead, or type what the test should cover.");
    }
    const truncated = text.length > MAX_LESSON_CHARS;
    if (truncated) text = text.slice(0, MAX_LESSON_CHARS);
    return { kind: "text", text, truncated, pages: chosen.length };
  }
}
