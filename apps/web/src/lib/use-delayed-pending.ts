import { useEffect, useRef, useState } from 'react';

/** A wait shorter than this shows nothing: a skeleton would only flicker. */
export const SKELETON_DELAY_MS = 300;

/** Whether a wait that began at `since` has lasted long enough, at `now`, for a skeleton. */
export function skeletonDue(
  since: number | undefined,
  now: number,
  delay = SKELETON_DELAY_MS,
) {
  return since !== undefined && now - since >= delay;
}

/** `true` once `pending` has held for `delay`; `false` as soon as it drops. */
export function useDelayedPending(pending: boolean, delay = SKELETON_DELAY_MS) {
  const since = useRef<number | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pending) {
      since.current = undefined;
      return;
    }
    since.current ??= Date.now();
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [pending, delay]);

  return pending && skeletonDue(since.current, now, delay);
}
