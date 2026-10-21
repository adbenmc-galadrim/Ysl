/**
 * What can be wrong with a parcel on arrival. Short words on purpose: they
 * are picked as chips, and "Autre" leaves the detail to the remark.
 */
export const DAMAGE_REASONS = [
  'Carton abîmé',
  'Ouvert',
  'Mouillé',
  'Contenu cassé',
  'Autre',
] as const;

export type DamageReason = (typeof DAMAGE_REASONS)[number];
