import { parseCnic, parsePkMobile, parseSpecializations } from "./pk";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
type Get = (key: string) => unknown;

const text = (v: unknown, max: number) => {
  const s = String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? null : s || undefined;
};

/** Guardian contact block on a student. Every field is optional; when given it must be valid. */
export function parseGuardian(get: Get): Result<{ guardianName: string | null; guardianPhone: string | null; guardianCnic: string | null }> {
  const name = text(get("guardianName"), 120);
  if (name === null) return { ok: false, error: "Guardian name must be 120 characters or fewer." };
  const phone = parsePkMobile(get("guardianPhone"));
  if (!phone.ok) return { ok: false, error: `Guardian phone: ${phone.error}` };
  const cnic = parseCnic(get("guardianCnic"));
  if (!cnic.ok) return { ok: false, error: `Guardian ${cnic.error.charAt(0).toLowerCase()}${cnic.error.slice(1)}` };
  return { ok: true, value: { guardianName: name ?? null, guardianPhone: phone.value, guardianCnic: cnic.value } };
}

/** Staff profile: phone, CNIC and subject specialisations. */
export function parseStaff(get: Get): Result<{ phone: string | null; cnic: string | null; specializations: string[] }> {
  const phone = parsePkMobile(get("phone"));
  if (!phone.ok) return { ok: false, error: phone.error };
  const cnic = parseCnic(get("cnic"));
  if (!cnic.ok) return { ok: false, error: cnic.error };
  const spec = parseSpecializations(get("specializations"));
  if (!spec.ok) return { ok: false, error: spec.error };
  return { ok: true, value: { phone: phone.value, cnic: cnic.value, specializations: spec.value } };
}
