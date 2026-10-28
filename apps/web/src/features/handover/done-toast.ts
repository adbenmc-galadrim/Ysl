import { useEffect, useSyncExternalStore } from 'react';

/** How long « 3 colis remis à Nora » stays over Colis. */
export const HANDOVER_TOAST_MS = 5_000;

export type HandoverToast = { count: number; firstName: string };

let current: HandoverToast | undefined;
const listeners = new Set<() => void>();

function publish(next: HandoverToast | undefined) {
  current = next;
  for (const listener of listeners) listener();
}

/** Called once the handover is written: Colis says so for a few seconds. */
export function announceHandover(toast: HandoverToast): void {
  publish(toast);
}

export function dismissHandoverToast(): void {
  publish(undefined);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => current;

/** The last handover, until it has been shown for `HANDOVER_TOAST_MS`. */
export function useHandoverToast(): HandoverToast | undefined {
  const toast = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      if (current === toast) dismissHandoverToast();
    }, HANDOVER_TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);
  return toast;
}
