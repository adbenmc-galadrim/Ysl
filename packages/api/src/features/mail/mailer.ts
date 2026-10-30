export type EmailMessage = {
  /** Stable across attempts: the provider may use it to drop a repeat. */
  idempotencyKey: string;
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  html?: string | null;
};

/**
 * `retry`: the provider is out of reach or refuses for now, the same message
 * may pass later. `rejected`: this message will never pass. Reasons are stored
 * on the row: no address or content in them.
 */
export type SendResult =
  | { status: 'sent'; providerMessageId: string | null }
  | { status: 'retry'; reason: string; retryAfterMs?: number }
  | { status: 'rejected'; reason: string };

/** How the server sends a mail; callers only know the queue, never the provider. */
export type Mailer = {
  send: (message: EmailMessage) => Promise<SendResult>;
};
