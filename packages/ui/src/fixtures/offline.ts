/**
 * What the app downloads on first launch to work without network: the
 * directory, the label reader model, the screens and fonts.
 */
import type { IconName } from '#icons';

export type OfflinePack = {
  id: string;
  icon: IconName;
  title: string;
  /** Size or content, shown once the pack is in: "312 personnes", "6 Mo". */
  detail: string;
};

export const OFFLINE_PACKS = {
  directory: {
    id: 'directory',
    icon: 'users',
    title: 'Annuaire',
    detail: '312 personnes',
  },
  labelReader: {
    id: 'label-reader',
    icon: 'scan',
    title: 'Lecture des étiquettes',
    detail: '42 Mo',
  },
  assets: {
    id: 'assets',
    icon: 'image',
    title: 'Écrans et polices',
    detail: '6 Mo',
  },
} satisfies Record<string, OfflinePack>;
