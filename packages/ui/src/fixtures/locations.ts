/**
 * Where the mailroom puts parcels away. The batch asks once and applies the
 * answer to every parcel scanned in it.
 */
export const STORAGE_LOCATIONS = [
  'Étagère A',
  'Étagère B',
  'Étagère C',
  'Sol, grand format',
  'Armoire fermée',
  'Réfrigérateur',
] as const;

export type StorageLocation = (typeof STORAGE_LOCATIONS)[number];
