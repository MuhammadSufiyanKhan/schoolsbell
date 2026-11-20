import { notFound } from "next/navigation";

/**
 * Route params arrive as strings. Anything that isn't a plain positive integer (that fits the database's
 * integer column) is a 404 and never reaches a query: "abc", "-1", "1.5", "99999999999" …
 */
export function idParam(raw: string): number {
  if (!/^\d{1,9}$/.test(raw)) notFound();
  const n = Number(raw);
  if (n <= 0) notFound();
  return n;
}
