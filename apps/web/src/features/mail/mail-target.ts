import { MAIL_TARGETS, type MailTarget } from '@repo/contract/mail';
import { useSyncExternalStore } from 'react';

export const MAIL_TARGET_KEY = 'courrier.mailTarget';

/** Mail iOS by `mailto:`: the only one that never fails offloaded (S5). */
export const DEFAULT_MAIL_TARGET: MailTarget = 'mailto';

type MailTargetStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isMailTarget(value: unknown): value is MailTarget {
  return (MAIL_TARGETS as readonly unknown[]).includes(value);
}

/**
 * The mail app chosen on this iPhone: the apps installed belong to the
 * phone, not to the account. Anything unknown reads as Mail.
 */
export function readMailTarget(
  storage: MailTargetStorage = localStorage,
): MailTarget {
  try {
    const saved = storage.getItem(MAIL_TARGET_KEY);
    return isMailTarget(saved) ? saved : DEFAULT_MAIL_TARGET;
  } catch {
    return DEFAULT_MAIL_TARGET;
  }
}

export function writeMailTarget(
  target: MailTarget,
  storage: MailTargetStorage = localStorage,
) {
  try {
    storage.setItem(MAIL_TARGET_KEY, target);
  } catch {
    return;
  }
}

let current: MailTarget | undefined;
const listeners = new Set<() => void>();

function getSnapshot() {
  current ??= readMailTarget();
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMailTarget(target: MailTarget) {
  current = target;
  writeMailTarget(target);
  listeners.forEach((listener) => listener());
}

export function useMailTarget() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
