import type { ModelsSnapshot } from '#/features/offline/packs';

/**
 * Where the reader's files stand, readable without pulling the preparation
 * store (and its service worker imports) into the scan modules: the OCR
 * only runs once the preparation put every file in the cache, so a read
 * never fetches 30 Mo behind the agent's back.
 */
let models: ModelsSnapshot = {
  state: 'running',
  progress: { bytes: 0, total: null, files: 0, filesDone: 0 },
};
const listeners = new Set<() => void>();

export function setModelsSnapshot(next: ModelsSnapshot): void {
  models = next;
  for (const listener of listeners) listener();
}

export const getModelsSnapshot = () => models;

export const modelsReady = () => models.state === 'done';

export const subscribeModels = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
