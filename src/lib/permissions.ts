import type { SessionUser } from "./session";

/** Who may edit whose staff profile: teachers by any admin; admins by the principal; anyone's own. */
export function canEditStaff(me: SessionUser, target: { id: number; role: string }) {
  return target.id === me.id || target.role === "teacher" || (me.isOwner && target.role === "admin");
}
