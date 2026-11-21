/** Pure helpers for year-end promotion (no database), so they are easy to test. */

export type ClassLite = { id: number; name: string; section: string };

/** "Grade 7", "Class 1", "Class 1st", "Year 10" → stem ("Grade ", "Class ", …), number, and any ordinal suffix. */
const num = (name: string) => {
  const m = /^(.*?)(\d+)(st|nd|rd|th)?\s*$/i.exec(name.trim());
  return m ? { stem: m[1], n: Number(m[2]), ord: m[3] ?? "" } : null;
};

const ordinal = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");

/** The name of the next grade: "Grade 1" → "Grade 2", "Class 1st" → "Class 2nd". Null if the name has no number. */
export function nextGradeName(name: string): string | null {
  const p = num(name);
  if (!p || p.n >= 99) return null;
  return `${p.stem}${p.n + 1}${p.ord ? ordinal(p.n + 1) : ""}`;
}

/** "Grade 2" before "Grade 10"; then by section. */
export function sortClasses<T extends ClassLite>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const x = num(a.name);
    const y = num(b.name);
    if (x && y && x.stem === y.stem && x.n !== y.n) return x.n - y.n;
    return a.name.localeCompare(b.name, undefined, { numeric: true }) || a.section.localeCompare(b.section, undefined, { numeric: true });
  });
}

/**
 * The existing class to promote into: the next grade in the SAME section ("Grade 1 – A" → "Grade 2 – A"). Sections are never
 * merged automatically; if there is no such class the page offers to create it. Null if there is none.
 */
export function suggestTarget(from: ClassLite, all: ClassLite[]): ClassLite | null {
  const p = num(from.name);
  if (!p) return null;
  const next = all.filter((c) => num(c.name)?.stem === p.stem && num(c.name)?.n === p.n + 1);
  return next.find((c) => c.section === from.section) ?? null;
}

/** `to`: a class id, null = graduated (no class), "new" = create the next grade's class first. */
export type Move = { studentId: number; from: number; to: number | null | "new" };

/**
 * Turn the submitted form into moves. `promote` entries are "studentId:fromClassId" (checked = promote; unchecked students
 * are simply absent and stay where they are). `targets[fromClassId]` is a class id, "graduate", "new", or ""/absent (leave the class alone).
 */
export function planMoves(promote: string[], targets: Record<number, string | undefined>): Move[] {
  const seen = new Set<number>();
  const moves: Move[] = [];
  for (const entry of promote) {
    const m = /^(\d{1,9}):(\d{1,9})$/.exec(entry);
    if (!m) continue;
    const studentId = Number(m[1]);
    const from = Number(m[2]);
    if (seen.has(studentId)) continue;
    const t = targets[from];
    if (!t) continue;
    if (t === "graduate") moves.push({ studentId, from, to: null });
    else if (t === "new") moves.push({ studentId, from, to: "new" });
    else if (/^\d{1,9}$/.test(t) && Number(t) !== from) moves.push({ studentId, from, to: Number(t) });
    else continue;
    seen.add(studentId);
  }
  return moves;
}
