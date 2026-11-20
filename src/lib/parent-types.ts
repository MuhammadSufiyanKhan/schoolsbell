/** What happened when guardian details were saved. Shown to the administrator (never stored). */
export type ParentLogin =
  | { kind: "created"; name: string; phone: string; password: string }
  /** `alreadyLinked`: nothing changed (a re-save), so the UI stays quiet. */
  | { kind: "linked"; name: string; phone: string; alreadyLinked: boolean }
  | { kind: "updated"; name: string; phone: string }
  | { kind: "none" };
