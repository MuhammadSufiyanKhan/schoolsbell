"use client";
import { useId, useState } from "react";
import { ArrowUpCircle } from "lucide-react";
import { promoteStudents } from "./actions";

export type PClass = {
  id: number;
  label: string;
  suggested: string; // "" | class id | "graduate"
  students: { id: number; name: string; rollNo: string }[];
};
export type PTarget = { id: number; label: string };

/**
 * One form for the whole school. Every student starts ticked ("promote"); untick the ones who failed and they simply stay
 * in their class. Each class picks where its promoted students go; "Don't move" leaves a whole class alone.
 */
export function PromotionForm({ classes, targets }: { classes: PClass[]; targets: PTarget[] }) {
  const base = useId();
  const [to, setTo] = useState<Record<number, string>>(() => Object.fromEntries(classes.map((c) => [c.id, c.suggested])));
  const [held, setHeld] = useState<Set<string>>(new Set()); // keys "studentId:classId" that are held back
  const key = (sid: number, cid: number) => `${sid}:${cid}`;

  const moving = classes.reduce((n, c) => n + (to[c.id] ? c.students.filter((s) => !held.has(key(s.id, c.id))).length : 0), 0);
  const staying = classes.reduce((n, c) => n + c.students.length, 0) - moving;

  const setAll = (c: PClass, hold: boolean) =>
    setHeld((prev) => {
      const next = new Set(prev);
      for (const s of c.students) {
        if (hold) next.add(key(s.id, c.id));
        else next.delete(key(s.id, c.id));
      }
      return next;
    });

  return (
    <form
      action={promoteStudents}
      onSubmit={(e) => {
        if (!window.confirm(`Move ${moving} student${moving === 1 ? "" : "s"} to their new class${staying ? ` and keep ${staying} where they are` : ""}? You can undo this straight afterwards.`)) e.preventDefault();
      }}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {classes.map((c) => {
          const held_ = c.students.filter((s) => held.has(key(s.id, c.id))).length;
          const selId = `${base}-${c.id}`;
          return (
            <article key={c.id} className="card" data-testid={`promo-class-${c.id}`}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{c.label}</h2>
                  <p className="text-xs text-muted">{c.students.length} student{c.students.length === 1 ? "" : "s"}{held_ ? ` · ${held_} held back` : ""}</p>
                </div>
                <div>
                  <label className="label" htmlFor={selId}>Promote to</label>
                  <select id={selId} name={`to_${c.id}`} className="input !py-1.5 text-sm" value={to[c.id]} onChange={(e) => setTo((p) => ({ ...p, [c.id]: e.target.value }))}>
                    <option value="">Don&apos;t move this class</option>
                    {targets.filter((t) => t.id !== c.id).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    <option value="graduate">Graduated (leaves the school&apos;s classes)</option>
                  </select>
                </div>
              </div>

              {c.students.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No students in this class.</p>
              ) : (
                <>
                  <div className="mt-3 flex gap-3 text-xs">
                    <button type="button" className="text-brand hover:underline" onClick={() => setAll(c, false)}>Promote everyone</button>
                    <button type="button" className="text-brand hover:underline" onClick={() => setAll(c, true)}>Hold everyone back</button>
                  </div>
                  <ul className="mt-2 divide-y divide-border border-t border-border text-sm">
                    {c.students.map((s) => {
                      const k = key(s.id, c.id);
                      const isHeld = held.has(k);
                      const id = `${base}-s-${s.id}`;
                      return (
                        <li key={s.id} className="flex items-center gap-3 py-2">
                          <input
                            id={id}
                            type="checkbox"
                            name="promote"
                            value={k}
                            checked={!isHeld}
                            onChange={(e) => setHeld((p) => { const n = new Set(p); if (e.target.checked) n.delete(k); else n.add(k); return n; })}
                            className="size-4"
                          />
                          <label htmlFor={id} className="flex-1 cursor-pointer">
                            {s.name} <span className="text-xs text-muted">({s.rollNo})</span>
                          </label>
                          {isHeld ? (
                            <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs text-warn">Stays in {c.label}</span>
                          ) : to[c.id] ? (
                            <span className="text-xs text-good">Promoted</span>
                          ) : (
                            <span className="text-xs text-muted">Not moving</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 text-xs text-muted">Untick students who did not pass: they stay in {c.label}.</p>
                </>
              )}
            </article>
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-1 mt-5 flex flex-wrap items-center gap-4 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
        <button className="btn" disabled={moving === 0} data-testid="promote-submit">
          <ArrowUpCircle className="size-4" aria-hidden /> Promote {moving} student{moving === 1 ? "" : "s"}
        </button>
        <span className="text-sm text-muted" data-testid="promote-summary">{moving} will move · {staying} will stay in their current class</span>
      </div>
    </form>
  );
}
