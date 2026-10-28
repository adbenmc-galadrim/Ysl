/**
 * How the person collecting proved who they are (D6): the QR of the e-mail,
 * the 4-digit code, a signature, or nothing but the agent's word (`manuel`,
 * picked by the name).
 */
export const HANDOVER_METHODS = ['qr', 'pin', 'signature', 'manuel'] as const;

export type HandoverMethod = (typeof HANDOVER_METHODS)[number];
