import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";
import { hasArabicScript, renderExamHtml } from "./exam-html";
import type { Exam, PaperMeta } from "./exam-types";

export class PdfUnavailableError extends Error {}

/** Where to find a Chrome. On Vercel we use the bundled serverless build; elsewhere a locally installed one. */
async function launchOptions() {
  if (process.env.VERCEL) {
    const { default: chromium } = await import("@sparticuz/chromium");
    return { executablePath: await chromium.executablePath(), args: chromium.args };
  }
  const candidates = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  const executablePath = candidates.find((p) => p && existsSync(p));
  if (!executablePath) throw new PdfUnavailableError("No Chrome/Chromium found. Set CHROME_PATH to enable PDF export.");
  return { executablePath, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] };
}

/** At most two PDFs render at once (a Chromium is heavy); others wait their turn briefly. */
let active = 0;
const waiters: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}

const fontCss = () => {
  try {
    return [400, 700]
      .map((w) => {
        const file = path.join(process.cwd(), "node_modules/@fontsource/noto-naskh-arabic/files", `noto-naskh-arabic-arabic-${w}-normal.woff2`);
        return `@font-face{font-family:"Noto Naskh Arabic";font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(file).toString("base64")}) format("woff2");}`;
      })
      .join("\n");
  } catch {
    return ""; // Urdu falls back to whatever fonts the machine has
  }
};

const RENDER_TIMEOUT_MS = 40_000;

export async function renderExamPdf(exam: Exam, meta: PaperMeta, variant: "student" | "teacher", school: string): Promise<Uint8Array> {
  const all = [exam.title, exam.instructions, meta.subject, school, ...exam.questions.flatMap((q) => [q.prompt, q.answer ?? "", ...(q.options ?? [])])].join(" ");
  const html = renderExamHtml(exam, meta, variant, school, hasArabicScript(all) ? fontCss() : "");

  return slot(async () => {
    let browser: Browser | undefined;
    const kill = setTimeout(() => void browser?.close().catch(() => {}), RENDER_TIMEOUT_MS);
    try {
      browser = await puppeteer.launch({ ...(await launchOptions()), headless: true });
      const page = await browser.newPage();
      // The paper is self-contained: no scripts, and nothing is allowed to touch the network or the filesystem.
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on("request", (r) => (r.url().startsWith("data:") || r.url() === "about:blank" ? void r.continue() : void r.abort()));
      await page.setContent(html, { waitUntil: "load", timeout: 20_000 });
      await page.evaluateHandle("document.fonts.ready").catch(() => {});
      return await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: '<div style="width:100%;font-size:8px;text-align:center;color:#555;font-family:sans-serif"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
        margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
        timeout: 30_000,
      });
    } finally {
      clearTimeout(kill);
      await browser?.close().catch(() => {});
    }
  });
}
