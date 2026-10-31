import type { DnsRecord } from '@repo/contract/mail';

export type EmailMessage = {
  /** Stable across attempts: the provider may use it to drop a repeat. */
  idempotencyKey: string;
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  html?: string | null;
  /** Overrides the mailer's own sender, field by field. */
  from?: { email?: string; name?: string };
};

/**
 * `retry`: the provider is out of reach or refuses for now, the same message
 * may pass later. `blocked`: the account is refused, no message can pass until
 * someone fixes it, so no attempt is spent. `rejected`: this message will never
 * pass. Reasons are stored on the row: no address or content in them.
 */
export type SendResult =
  | { status: 'sent'; providerMessageId: string | null }
  | { status: 'retry'; reason: string; retryAfterMs?: number }
  | { status: 'blocked'; reason: string }
  | { status: 'rejected'; reason: string };

/** How the server sends a mail; callers only know the queue, never the provider. */
export type Mailer = {
  send: (message: EmailMessage) => Promise<SendResult>;
};

/**
 * What the provider knows of a domain. `authenticated` says the DNS is in
 * place, not who the domain belongs to. `notFound`: the provider does not have
 * it. `invalid`: it refuses this name. `unavailable`: try again later.
 */
export type DomainResult =
  | {
      status: 'found';
      created: boolean;
      authenticated: boolean;
      records: DnsRecord[];
    }
  | { status: 'notFound' }
  | { status: 'invalid' }
  | { status: 'unavailable'; reason: string };

/** How the server declares and checks sending domains at the provider. */
export type MailDomains = {
  register: (domain: string) => Promise<DomainResult>;
  check: (domain: string) => Promise<DomainResult>;
  remove: (domain: string) => Promise<void>;
};
