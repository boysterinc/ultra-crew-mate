// Central access control for the AutoLap feature.
// Step 1: password gate only — no AutoLap logic is wired up yet.

const AUTOLAP_PASSWORD = "rxt4289";
const SESSION_KEY = "autoLapAccessUnlocked";

/**
 * Returns true if the current session has unlocked AutoLap access.
 * Returns false otherwise.
 */
export function checkAutoLapAccess(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Validate a password attempt. If correct, mark this session as unlocked
 * and return true. Otherwise return false.
 */
export function tryUnlockAutoLap(password: string): boolean {
  if (password === AUTOLAP_PASSWORD) {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    return true;
  }
  return false;
}

/**
 * Lock AutoLap access again (clears the session unlock).
 */
export function lockAutoLapAccess(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
