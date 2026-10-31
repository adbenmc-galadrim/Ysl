/**
 * Who sends a mail: `phone`, the agent's mail app (S5); `server`, the provider,
 * asked for through the sync. A device only writes the request: the server draws
 * the code and moves the row from then on.
 */
export const MAIL_CHANNELS = ['phone', 'server'] as const;

export type MailChannel = (typeof MAIL_CHANNELS)[number];

/** Past this, a request not sent yet gives the parcels back to the phone. */
export const SERVER_MAIL_WAIT_MS = 15 * 60_000;

export const EMAIL_OUTBOX_STATUSES = [
  'queued',
  'sending',
  'sent',
  'failed',
] as const;

export type EmailOutboxStatus = (typeof EMAIL_OUTBOX_STATUSES)[number];

/**
 * What the provider says became of a mail once it left, weakest first: a later
 * word only counts if it goes further, whatever order the events arrive in.
 */
export const DELIVERY_STATUSES = [
  'delivered',
  'unsubscribed',
  'complained',
  'bounced',
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Why the server takes no more mail to an address, kept past the queue's own rows. */
export const SUPPRESSION_REASONS = ['unsubscribed', 'complained'] as const;

export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];
