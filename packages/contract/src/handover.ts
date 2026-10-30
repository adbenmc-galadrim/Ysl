/**
 * How the person collecting proved who they are (D6): the QR of the e-mail,
 * the 4-digit code, a signature, or nothing but the agent's word (`manuel`,
 * picked by the name).
 */
export const HANDOVER_METHODS = ['qr', 'pin', 'signature', 'manuel'] as const;

export type HandoverMethod = (typeof HANDOVER_METHODS)[number];

/**
 * Why a handover was undone (F44). None on a handover the synchronisation
 * cancelled because it lost its parcels to another iPhone: nobody undid it.
 */
export const HANDOVER_CANCEL_REASONS = [
  'wrong_parcel',
  'wrong_person',
  'entry_error',
] as const;

export type HandoverCancelReason = (typeof HANDOVER_CANCEL_REASONS)[number];
