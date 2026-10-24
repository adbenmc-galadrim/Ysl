import {
  applyCorners,
  DEFAULT_CORNERS,
  isCornerRadius,
  isCornerTiles,
  type CornerSetting,
} from '@repo/ui';
import { useSyncExternalStore } from 'react';

export const CORNERS_KEY = 'courrier.corners';

type CornerStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The preset saved on this device; anything unknown or broken reads as the default. */
export function readCornerSetting(
  storage: CornerStorage = localStorage,
): CornerSetting {
  let parsed: unknown;
  try {
    parsed = JSON.parse(storage.getItem(CORNERS_KEY) ?? 'null');
  } catch {
    return DEFAULT_CORNERS;
  }
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_CORNERS;
  const { radius, tiles } = parsed as Record<string, unknown>;
  return {
    radius: isCornerRadius(radius) ? radius : DEFAULT_CORNERS.radius,
    tiles: isCornerTiles(tiles) ? tiles : DEFAULT_CORNERS.tiles,
  };
}

export function writeCornerSetting(
  setting: CornerSetting,
  storage: CornerStorage = localStorage,
) {
  storage.setItem(CORNERS_KEY, JSON.stringify(setting));
}

let current: CornerSetting | undefined;
const listeners = new Set<() => void>();

/** Reads the saved preset and draws it, before the first frame. */
export function bootCorners() {
  current = readCornerSetting();
  applyCorners(document.documentElement, current);
}

function getSnapshot() {
  current ??= readCornerSetting();
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setCornerSetting(setting: CornerSetting) {
  current = setting;
  writeCornerSetting(setting);
  applyCorners(document.documentElement, setting);
  listeners.forEach((listener) => listener());
}

export function useCornerSetting() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
