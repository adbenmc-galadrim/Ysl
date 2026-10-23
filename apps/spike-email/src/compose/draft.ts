import type { Draft } from '#/compose/urls';
import type { KeyValueStore } from '#/journal';

export type Composition = Draft & { replyTo: string; source: string };

const STORAGE_KEY = 'spike-email:draft';

export const EMPTY_COMPOSITION: Composition = {
  to: '',
  cc: '',
  bcc: '',
  subject: '',
  body: '',
  replyTo: 'courrier@exemple.fr',
  source: 'libre',
};

export function readComposition(store: KeyValueStore): Composition {
  try {
    const raw = store.getItem(STORAGE_KEY);
    const parsed = (raw ? JSON.parse(raw) : {}) as Partial<Composition> | null;
    return { ...EMPTY_COMPOSITION, ...parsed };
  } catch {
    return EMPTY_COMPOSITION;
  }
}

export function saveComposition(
  store: KeyValueStore,
  composition: Composition,
): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(composition));
  } catch {
    return;
  }
}
