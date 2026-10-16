export const STEP_UP_MS = 5 * 60_000;
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60_000;
export function proofIsValid(proof: { userId: string; sessionId: string; expiresAt: number }, userId: string, sessionId: string, now: number) {
  return proof.userId === userId && proof.sessionId === sessionId && proof.expiresAt > now;
}
export function recoverySessionAllowed(methods: { method: string }[]) {
  return methods.some((entry) => entry.method === "recovery");
}
export function canRestoreTrash(deletedAt: string, now: number) {
  return now - new Date(deletedAt).getTime() < TRASH_RETENTION_MS;
}