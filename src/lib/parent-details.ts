/**
 * A parent account stores only the login (name + mobile). The guardian's ID card (CNIC) and the guardian
 * details as entered live on each CHILD's record. This pulls them together for display and flags
 * disagreements (e.g. a typo on one sibling), which the administrator should fix on the child's page.
 * Pure: no I/O.
 */
export type ParentAccount = { phone: string | null; email: string };
export type KidGuardian = { guardianName: string | null; guardianPhone: string | null; guardianCnic: string | null };

const distinct = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];

export function summarizeParent(parent: ParentAccount, kids: KidGuardian[]) {
  const cnics = distinct(kids.map((k) => k.guardianCnic));
  const names = distinct(kids.map((k) => k.guardianName));
  const kidPhones = distinct(kids.map((k) => k.guardianPhone));
  // The account's own mobile wins; for manually created parents (email login) fall back to what's recorded on a child.
  const mobile = parent.phone ?? kidPhones[0] ?? null;
  return {
    mobile,
    cnics,
    names,
    /** More than one CNIC recorded across this parent's children. */
    cnicConflict: cnics.length > 1,
    /** A child records a different guardian mobile than the account's login number. */
    phoneConflict: !!parent.phone && kidPhones.some((p) => p !== parent.phone),
  };
}
