/** Wrong PINs in a row before the pad waits: four digits are guessed fast (§8.7). */
export const PIN_MAX_FAILURES = 5;

export const PIN_LOCK_MS = 30 * 1000;

export const PIN_ATTEMPTS_KEY = 'courrier.remise.essais';

/** Wrong PINs since the last good one, and the end of the wait if any. */
export type PinAttempts = { failures: number; lockedUntil: number | null };

export const NO_ATTEMPTS: PinAttempts = { failures: 0, lockedUntil: null };

/** One more wrong PIN; the fifth starts the wait and the count over. */
export function pinFailed(state: PinAttempts, now: number): PinAttempts {
  const failures = state.failures + 1;
  return failures >= PIN_MAX_FAILURES
    ? { failures: 0, lockedUntil: now + PIN_LOCK_MS }
    : { failures, lockedUntil: null };
}

/** Milliseconds left to wait, 0 when the pad may be used. */
export function pinLockLeft(state: PinAttempts, now: number): number {
  return state.lockedUntil === null ? 0 : Math.max(0, state.lockedUntil - now);
}

type KeyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Kept on the iPhone, so closing and reopening the app does not reset the
 * count; a good PIN clears it.
 */
export function readPinAttempts(
  storage: KeyStorage = localStorage,
): PinAttempts {
  try {
    const raw = storage.getItem(PIN_ATTEMPTS_KEY);
    if (!raw) return NO_ATTEMPTS;
    const parsed = JSON.parse(raw) as Partial<PinAttempts>;
    return {
      failures: typeof parsed.failures === 'number' ? parsed.failures : 0,
      lockedUntil:
        typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : null,
    };
  } catch {
    return NO_ATTEMPTS;
  }
}

export function writePinAttempts(
  state: PinAttempts,
  storage: KeyStorage = localStorage,
) {
  try {
    if (state.failures === 0 && state.lockedUntil === null) {
      storage.removeItem(PIN_ATTEMPTS_KEY);
    } else {
      storage.setItem(PIN_ATTEMPTS_KEY, JSON.stringify(state));
    }
  } catch {
    return;
  }
}
