/**
 * Pakistani phone / CNIC helpers. Pure functions (no I/O) so they are safe on server and client
 * and easy to unit-test.
 *
 * Storage format (canonical):  phone → "+923001234567"   CNIC → "35202-1234567-1"
 * Display format:              phone → "0300-1234567"    CNIC → "35202-1234567-1"
 */

export type Parsed = { ok: true; value: string | null } | { ok: false; error: string };

const empty = (v: unknown) => v == null || String(v).trim() === "";

/**
 * Accepts the ways people actually write mobile numbers:
 *   0300-1234567, 03001234567, 0300 1234567, 3001234567,
 *   +92 300 1234567, +92-300-1234567, 0092 300 1234567, 923001234567, (0300) 123 4567
 * Mobile numbers only: national form is 3 + operator digit 0-5 + 8 digits.
 * Empty input is valid and yields null (the field is optional).
 */
export function parsePkMobile(input: unknown): Parsed {
  if (empty(input)) return { ok: true, value: null };
  const raw = String(input).trim();
  // Only digits, spaces, dashes, dots, parentheses and a single leading "+" are allowed.
  if (!/^\+?[\d\s\-().]+$/.test(raw)) return { ok: false, error: "Phone number can only contain digits, spaces and dashes." };
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0092")) digits = digits.slice(4);
  else if (digits.startsWith("92") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (!/^3[0-5]\d{8}$/.test(digits)) {
    return { ok: false, error: "Enter a valid Pakistani mobile number, e.g. 0300-1234567 or +92 300 1234567." };
  }
  return { ok: true, value: `+92${digits}` };
}

/** "+923001234567" → "0300-1234567". Falls back to the raw value if it isn't canonical. */
export function formatPkMobile(stored: string | null | undefined) {
  if (!stored) return "";
  const m = /^\+92(3[0-5]\d)(\d{7})$/.exec(stored);
  return m ? `0${m[1]}-${m[2]}` : stored;
}

/** "tel:" link target for a stored number. */
export const telHref = (stored: string | null | undefined) => (stored && /^\+92\d{10}$/.test(stored) ? `tel:${stored}` : undefined);

/** CNIC: 13 digits, written with or without dashes/spaces. Stored as XXXXX-XXXXXXX-X. */
export function parseCnic(input: unknown): Parsed {
  if (empty(input)) return { ok: true, value: null };
  const raw = String(input).trim();
  if (!/^[\d\s-]+$/.test(raw)) return { ok: false, error: "ID card number can only contain digits and dashes." };
  const d = raw.replace(/\D/g, "");
  if (d.length !== 13) return { ok: false, error: "ID card (CNIC) number must be 13 digits, e.g. 35202-1234567-1." };
  if (d.startsWith("0")) return { ok: false, error: "That doesn't look like a valid CNIC (it can't start with 0)." };
  if (/^(\d)\1{12}$/.test(d)) return { ok: false, error: "That doesn't look like a valid CNIC." };
  return { ok: true, value: `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}` };
}

/** Show only the last 4 digits, for places that don't need the whole number. */
export const maskCnic = (cnic: string | null | undefined) => (cnic ? `•••••-•••${cnic.slice(-6, -2).replace("-", "")}-${cnic.slice(-1)}` : "");

/**
 * "Maths, Physics ; physics" → ["Maths", "Physics"]  (comma/semicolon/newline separated,
 * de-duplicated case-insensitively, each ≤ 40 chars, at most 10).
 */
export function parseSpecializations(input: unknown): { ok: true; value: string[] } | { ok: false; error: string } {
  if (empty(input)) return { ok: true, value: [] };
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(input).split(/[,;\n]/)) {
    const t = part.trim().replace(/\s+/g, " ");
    if (!t) continue;
    if (t.length > 40) return { ok: false, error: "Each subject name must be 40 characters or fewer." };
    if (!/^[\p{L}\p{N}][\p{L}\p{N} .&'()/+-]*$/u.test(t)) return { ok: false, error: `“${t.slice(0, 20)}” isn't a valid subject name.` };
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  if (out.length > 10) return { ok: false, error: "List at most 10 specialisations." };
  return { ok: true, value: out };
}

/** Normalise a subject name for comparison: case, spacing, plurals, and the Math/Maths/Mathematics spellings. */
function canonSubject(name: string) {
  const t = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (/^math(s|ematics)?$/.test(t)) return "mathematics";
  return t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t;
}

/**
 * Does a teacher's specialisation list cover this subject name?
 * Deliberately exact (after normalising): a fuzzy match would call a "Physics" specialist qualified
 * for "Physical Education". A false negative only means no ★ hint, which is harmless.
 */
export function isSpecialist(specializations: string[] | null | undefined, subjectName: string) {
  const s = canonSubject(subjectName);
  if (!s) return false;
  return (specializations ?? []).some((sp) => canonSubject(sp) === s);
}
