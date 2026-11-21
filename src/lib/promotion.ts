/** Pure helpers for year-end promotion (no database), so they are easy to test. */

export type ClassLite = { id: number; name: string; section: string };

const num = (name: string) => {
  const m = /^(.*?)(\d+)\s*$/.exec(name.trim());
  return m ? { stem: m[1], n: Number(m[2]) } : null;
};

/** "Grade 2" before "Grade 10"; then by section. */
export function sortClasses<T extends ClassLite>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const x = num(a.name);
    const y = num(b.name);
    if (x && y && x.stem === y.stem && x.n !== y.n) return x.n - y.n;
    return a.name.localeCompare(b.name, undefined, { numeric: true }) || a.section.localeCompare(b.section, undefined, { numeric: true });
  });
}

/** The next grade, same section: "Grade 1 – A" → "Grade 2 – A". Null if there isn't one. */
export function suggestTarget(from: ClassLite, all: ClassLite[]): ClassLite | null {
  const p = num(from.name);
  if (!p) return null;
  return all.find((c) => c.section === from.section && num(c.name)?.stem === p.stem && num(c.name)?.n === p.n + 1) ?? null;
}

export type Move = { studentId: number; from: number; to: number | null };

/**
 * Turn the submitted form into moves. `promote` entries are "studentId:fromClassId" (checked = promote; unchecked students
 * are simply absent and stay where they are). `targets[fromClassId]` is a class id, "graduate", or ""/absent (leave the class alone).
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
    else if (/^\d{1,9}$/.test(t) && Number(t) !== from) moves.push({ studentId, from, to: Number(t) });
    else continue;
    seen.add(studentId);
  }
  return moves;
}
