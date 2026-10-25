import { useCallback, useState } from 'react';
import { SECTION_IDS, type SectionId } from '#/features/parcels/sections';

export const FOLDED_KEY = 'courrier.colis.folded';

/** What went out today is done: its count is enough at the desk. */
export const DEFAULT_FOLDED: readonly SectionId[] = ['handedOver'];

type FoldStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The sections folded on this iPhone; anything unknown or broken reads as the default. */
export function readFolded(
  storage: FoldStorage = localStorage,
): readonly SectionId[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(storage.getItem(FOLDED_KEY) ?? 'null');
  } catch {
    return DEFAULT_FOLDED;
  }
  if (!Array.isArray(parsed)) return DEFAULT_FOLDED;
  return SECTION_IDS.filter((id) => parsed.includes(id));
}

export function writeFolded(
  folded: readonly SectionId[],
  storage: FoldStorage = localStorage,
) {
  try {
    storage.setItem(FOLDED_KEY, JSON.stringify(folded));
  } catch {
    return;
  }
}

export function toggleFolded(
  folded: readonly SectionId[],
  id: SectionId,
): readonly SectionId[] {
  return folded.includes(id)
    ? folded.filter((current) => current !== id)
    : [...folded, id];
}

/** The folded sections of Colis, kept across launches. */
export function useFoldedSections() {
  const [folded, setFolded] = useState(() => readFolded());
  const toggle = useCallback((id: SectionId) => {
    setFolded((current) => {
      const next = toggleFolded(current, id);
      writeFolded(next);
      return next;
    });
  }, []);
  return [folded, toggle] as const;
}
