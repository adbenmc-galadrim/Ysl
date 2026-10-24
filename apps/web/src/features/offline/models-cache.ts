import { readerAssetUrls } from '@repo/ocr/assets';
import type { CacheLike } from '#/features/offline/download';

/** The cache the service worker reads for the reader files (`vite.config.ts`). */
export const MODELS_CACHE = 'courrier-models';

/** The reader files of this build, absolute; the app lives at the origin's root. */
export function readerUrls(): string[] {
  return readerAssetUrls(new URL('/', location.href).href);
}

/** Null where the Cache API is missing (insecure context): nothing to prepare. */
export async function openModelsCache(): Promise<CacheLike | null> {
  if (typeof caches === 'undefined') return null;
  try {
    return await caches.open(MODELS_CACHE);
  } catch {
    return null;
  }
}
