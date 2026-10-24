/**
 * Runs `load` the first time it is asked, shares the promise with every
 * later caller, and forgets a failure so the next call tries again.
 */
export function once<T>(load: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | null = null;
  return () =>
    (loading ??= load().catch((error: unknown) => {
      loading = null;
      throw error;
    }));
}
