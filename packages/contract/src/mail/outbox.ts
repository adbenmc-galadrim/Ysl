export const EMAIL_OUTBOX_STATUSES = [
  'queued',
  'sending',
  'sent',
  'failed',
] as const;

export type EmailOutboxStatus = (typeof EMAIL_OUTBOX_STATUSES)[number];
