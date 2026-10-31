import { z } from 'zod';

export const MAIL_DOMAIN_STATUSES = ['pending', 'verified'] as const;

export const DNS_RECORD_KINDS = ['code', 'spf', 'dkim', 'dmarc'] as const;

/** A DNS record the client's IT adds, as the provider gives it. */
const dnsRecord = z.object({
  kind: z.enum(DNS_RECORD_KINDS),
  type: z.string(),
  host: z.string(),
  value: z.string(),
  configured: z.boolean(),
});

export type DnsRecord = z.infer<typeof dnsRecord>;

export const SENDER_NAME_MAX = 70;

export const saveSenderInput = z.object({
  name: z.string().trim().min(1).max(SENDER_NAME_MAX),
  email: z.email().max(254),
});

export type SaveSenderInput = z.infer<typeof saveSenderInput>;

/**
 * `unavailable`: the provider did not answer. `taken`: the domain is not this
 * company's to claim. `invalid`: the provider refuses the name.
 */
const SENDER_PROBLEMS = ['unavailable', 'taken', 'invalid'] as const;

export const senderSettings = z.object({
  /** Where mails leave from until the domain is verified; null when not set. */
  platformAddress: z.email().nullable(),
  /** False without an API key: the sender can be saved, not verified. */
  providerConfigured: z.boolean(),
  sender: z
    .object({
      name: z.string(),
      email: z.string(),
      domain: z.string(),
      status: z.enum(MAIL_DOMAIN_STATUSES),
      records: z.array(dnsRecord),
      verifiedAt: z.date().nullable(),
    })
    .nullable(),
  problem: z.enum(SENDER_PROBLEMS).nullable(),
});

export type SenderSettings = z.infer<typeof senderSettings>;
