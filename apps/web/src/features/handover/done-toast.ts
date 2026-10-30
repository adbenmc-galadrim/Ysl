import { useEffect, useSyncExternalStore } from 'react';

/** How long « Déjà remis à Nora par un collègue » stays over Colis. */
export const HANDOVER_TOAST_MS = 5_000;

/**
 * What Colis says of a handover: another iPhone had recorded it first, found
 * by the synchronisation, or it was just undone. The one written here has its
 * own screen (YSL-76).
 */
export type HandoverToast =
  | {
      kind: 'conflict';
      firstName: string | null;
      byMe: boolean;
    }
  | {
      /** Undone from its confirmation, which has just closed (F44). */
      kind: 'cancelled';
      count: number;
    };

let current: HandoverToast | undefined;
const listeners = new Set<() => void>();

function publish(next: HandoverToast | undefined) {
  current = next;
  for (const listener of listeners) listener();
}

/** Called once a handover is found beaten or has been undone: Colis says so for a few seconds. */
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
