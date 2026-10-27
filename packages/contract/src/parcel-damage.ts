/**
 * What can be wrong with a parcel on arrival (zone d'ombre « Colis abîmé »).
 * Short words on purpose: they are picked as chips, and "autre" leaves the
 * detail to the remark.
 */
export const DAMAGE_REASONS = [
  'carton_abime',
  'ouvert',
  'mouille',
  'contenu_casse',
  'autre',
] as const;

export type DamageReason = (typeof DAMAGE_REASONS)[number];

export const DAMAGE_LABEL = {
  carton_abime: 'Carton abîmé',
  ouvert: 'Ouvert',
  mouille: 'Mouillé',
  contenu_casse: 'Contenu cassé',
  autre: 'Autre',
} as const satisfies Record<DamageReason, string>;

export function isDamageReason(value: unknown): value is DamageReason {
  return (
    typeof value === 'string' &&
    (DAMAGE_REASONS as readonly string[]).includes(value)
  );
}

/**
 * The reserve a parcel carries, as its row has it: the reason, the remark,
 * whether the pickup e-mail should mention it and whether a reserve was
 * made with the carrier. Lifting it clears the columns; the history keeps
 * both events.
 */
export type ParcelDamage = {
  reason: DamageReason;
  note: string | null;
  notifyRecipient: boolean;
  carrierReserve: boolean;
  at: Date;
};

/** The damage columns of a parcel row, server or device. */
export type DamageColumns = {
  damage?: string | null;
  damageNote?: string | null;
  damageNotify?: boolean | null;
  damageCarrierReserve?: boolean | null;
  damagedAt?: Date | null;
};

/**
 * The reserve of a row, or nothing: none set, or a reason this version does
 * not know (written by a newer app), which it leaves alone.
 */
export function damageOf(row: DamageColumns): ParcelDamage | null {
  if (!isDamageReason(row.damage) || !row.damagedAt) return null;
  return {
    reason: row.damage,
    note: row.damageNote?.trim() || null,
    notifyRecipient: row.damageNotify ?? false,
    carrierReserve: row.damageCarrierReserve ?? false,
    at: row.damagedAt,
  };
}

/** The columns that set a reserve on a row, or lift it with `null`. */
export function damageColumns(damage: ParcelDamage | null): {
  damage: DamageReason | null;
  damageNote: string | null;
  damageNotify: boolean;
  damageCarrierReserve: boolean;
  damagedAt: Date | null;
} {
  if (!damage) {
    return {
      damage: null,
      damageNote: null,
      damageNotify: false,
      damageCarrierReserve: false,
      damagedAt: null,
    };
  }
  return {
    damage: damage.reason,
    damageNote: damage.note?.trim() || null,
    damageNotify: damage.notifyRecipient,
    damageCarrierReserve: damage.carrierReserve,
    damagedAt: damage.at,
  };
}

/**
 * What the pickup e-mail says about the parcel's state (YSL-61): the
 * reason and the remark, only when the agent asked to warn the employee.
 */
export function damageForEmail(
  row: DamageColumns,
): { label: string; note: string | null } | null {
  const damage = damageOf(row);
  if (!damage?.notifyRecipient) return null;
  return { label: DAMAGE_LABEL[damage.reason], note: damage.note };
}
