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
