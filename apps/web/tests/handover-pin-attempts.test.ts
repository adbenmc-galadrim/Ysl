import { describe, expect, it } from 'vitest';
import {
  NO_ATTEMPTS,
  PIN_LOCK_MS,
  type PinAttempts,
  pinFailed,
  pinLockLeft,
  readPinAttempts,
  writePinAttempts,
} from '#/features/handover/pin-attempts';

const fail = (times: number, now = 0) => {
  let state: PinAttempts = NO_ATTEMPTS;
  for (let i = 0; i < times; i += 1) state = pinFailed(state, now);
  return state;
};

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    items,
  };
}

describe('the PIN pad wait', () => {
  it('lets four wrong PINs through and stops the fifth for 30 s', () => {
    expect(pinLockLeft(fail(4), 0)).toBe(0);

    const locked = fail(5, 1000);

    expect(pinLockLeft(locked, 1000)).toBe(PIN_LOCK_MS);
    expect(pinLockLeft(locked, 1000 + PIN_LOCK_MS - 1)).toBe(1);
    expect(pinLockLeft(locked, 1000 + PIN_LOCK_MS)).toBe(0);
  });

  it('gives five tries again once the wait is over', () => {
    let state = fail(5);
    for (let i = 0; i < 4; i += 1) state = pinFailed(state, PIN_LOCK_MS);

    expect(pinLockLeft(state, PIN_LOCK_MS)).toBe(0);
  });

  it('keeps the count across a relaunch, and forgets it once cleared', () => {
    const storage = memoryStorage();
    writePinAttempts(fail(3), storage);

    expect(readPinAttempts(storage)).toEqual({
      failures: 3,
      lockedUntil: null,
    });

    writePinAttempts(NO_ATTEMPTS, storage);

    expect(storage.items.size).toBe(0);
    expect(readPinAttempts(storage)).toEqual(NO_ATTEMPTS);
  });
});
