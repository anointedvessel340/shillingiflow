import { describe, it, expect } from "bun:test";
import { STEP_UP_MS, TRASH_RETENTION_MS, proofIsValid, recoverySessionAllowed, canRestoreTrash } from "./auth-rules";
describe("account security rules", () => {
  it("expires step-up after exactly five minutes", () => {
    expect(STEP_UP_MS).toBe(300000);
    const proof = { userId: "owner", sessionId: "session", expiresAt: STEP_UP_MS };
    expect(proofIsValid(proof, "owner", "session", 299999)).toBe(true);
    expect(proofIsValid(proof, "owner", "session", 300000)).toBe(false);
  });
  it("binds proof to both user and session", () => {
    const proof = { userId: "owner", sessionId: "session", expiresAt: 300000 };
    expect(proofIsValid(proof, "other", "session", 0)).toBe(false);
    expect(proofIsValid(proof, "owner", "other", 0)).toBe(false);
  });
  it("does not accept ordinary sign-in as password recovery", () => {
    expect(recoverySessionAllowed([{ method: "password" }])).toBe(false);
    expect(recoverySessionAllowed([{ method: "recovery" }])).toBe(true);
  });
  it("keeps Trash recoverable for thirty days", () => {
    expect(TRASH_RETENTION_MS).toBe(2592000000);
    expect(canRestoreTrash("2026-10-01T00:00:00Z", Date.parse("2026-10-30T23:59:59Z"))).toBe(true);
    expect(canRestoreTrash("2026-10-01T00:00:00Z", Date.parse("2026-10-31T00:00:00Z"))).toBe(false);
  });
});