import { useSyncExternalStore } from 'react';

export const SCAN_SOUND_KEY = 'courrier.scanSound';

type SoundStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Whether the beep plays on each label read; on unless the agent turned it off. */
export function readScanSound(storage: SoundStorage = localStorage): boolean {
  try {
    return storage.getItem(SCAN_SOUND_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeScanSound(
  on: boolean,
  storage: SoundStorage = localStorage,
) {
  try {
    storage.setItem(SCAN_SOUND_KEY, String(on));
  } catch {
    return;
  }
}

let current: boolean | undefined;
const listeners = new Set<() => void>();

/** The setting as the scan screen reads it, without touching storage on each beep. */
export function scanSoundOn(): boolean {
  current ??= readScanSound();
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setScanSound(on: boolean) {
  current = on;
  writeScanSound(on);
  listeners.forEach((listener) => listener());
}

export function useScanSound() {
  return useSyncExternalStore(subscribe, scanSoundOn, scanSoundOn);
}
