import { DNS_RECORD_KINDS, type DnsRecord } from '@repo/contract/mail';
import type {
  DomainResult,
  Mailer,
  MailDomains,
  SendResult,
} from '#features/mail/mailer';

const ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const DOMAINS_ENDPOINT = 'https://api.brevo.com/v3/senders/domains';
const SEND_TIMEOUT_MS = 15_000;
const DOMAIN_TIMEOUT_MS = 10_000;

export type BrevoOptions = {
  apiKey: string;
  from: { email: string; name: string };
  fetch?: typeof globalThis.fetch;
};

function waitAsked(response: Response): number | undefined {
  const seconds = Number(
    response.headers.get('retry-after') ??
      response.headers.get('x-sib-ratelimit-reset'),
  );
  return seconds > 0 ? seconds * 1_000 : undefined;
}

async function errorCode(response: Response): Promise<string | undefined> {
  const body = (await response.json().catch(() => null)) as {
    code?: unknown;
  } | null;
  return typeof body?.code === 'string' ? body.code : undefined;
}

async function readResult(response: Response): Promise<SendResult> {
  if (response.ok) {
    const body = (await response.json().catch(() => null)) as {
      messageId?: unknown;
    } | null;
    return {
      status: 'sent',
      providerMessageId:
        typeof body?.messageId === 'string' ? body.messageId : null,
    };
  }
  // The message body may quote the address: only the status and the code are kept.
  const code = await errorCode(response);
  const reason = `brevo ${response.status}${code ? ` ${code}` : ''}`;
  if (code === 'duplicate_request') {
    return { status: 'sent', providerMessageId: null };
  }
  if (response.status === 400) return { status: 'rejected', reason };
  if ([401, 402, 403].includes(response.status)) {
    return { status: 'blocked', reason };
  }
  return { status: 'retry', reason, retryAfterMs: waitAsked(response) };
}

/** Brevo's transactional API, one implementation of `Mailer`. */
export function brevoMailer({
  apiKey,
  from,
  fetch: send = globalThis.fetch,
}: BrevoOptions): Mailer {
  return {
    send: async (message) => {
      let response: Response;
      try {
        response = await send(ENDPOINT, {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            sender: { ...from, ...message.from },
            to: [
              {
                email: message.to,
                ...(message.toName ? { name: message.toName } : {}),
              },
            ],
            subject: message.subject,
            textContent: message.text,
            ...(message.html ? { htmlContent: message.html } : {}),
            ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
            ...(message.attachments?.length
              ? {
                  attachment: message.attachments.map((file) => ({
                    name: file.name,
                    content: file.contentBase64,
                  })),
                }
              : {}),
            headers: { IdempotencyKey: message.idempotencyKey },
          }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
      } catch (error) {
        const name = error instanceof Error ? error.name : 'error';
        return { status: 'retry', reason: `brevo unreachable: ${name}` };
      }
      return readResult(response);
    },
  };
}

export type BrevoDomainsOptions = {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
};

function recordKind(key: string): DnsRecord['kind'] {
  const name = key.toLowerCase();
  if (name.includes('dkim')) return 'dkim';
  if (name.includes('dmarc')) return 'dmarc';
  if (name.includes('spf')) return 'spf';
  return 'code';
}

/** Brevo names its records differently across accounts: only their shape is relied on. */
function readRecords(raw: unknown): DnsRecord[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const records: DnsRecord[] = [];
  for (const [key, entry] of Object.entries(raw)) {
    const { type, host_name, value, status } = (entry ?? {}) as Record<
      string,
      unknown
    >;
    if (typeof value !== 'string' || !value) continue;
    records.push({
      kind: recordKind(key),
      type: typeof type === 'string' ? type : 'TXT',
      host: typeof host_name === 'string' ? host_name : '@',
      value,
      configured: status === true,
    });
  }
  return records.sort(
    (a, b) =>
      DNS_RECORD_KINDS.indexOf(a.kind) - DNS_RECORD_KINDS.indexOf(b.kind),
  );
}

/** Brevo's domain API, one implementation of `MailDomains`. */
export function brevoDomains({
  apiKey,
  fetch: send = globalThis.fetch,
}: BrevoDomainsOptions): MailDomains {
  const call = (path: string, method: string, body?: unknown) =>
    send(`${DOMAINS_ENDPOINT}${path}`, {
      method,
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(DOMAIN_TIMEOUT_MS),
    });
  const pathOf = (domain: string) => `/${encodeURIComponent(domain)}`;

  const read = async (
    domain: string,
    created: boolean,
  ): Promise<DomainResult> => {
    const response = await call(pathOf(domain), 'GET');
    if (response.status === 404 || response.status === 400) {
      return { status: 'notFound' };
    }
    if (!response.ok) {
      return { status: 'unavailable', reason: `brevo ${response.status}` };
    }
    const body = (await response.json().catch(() => null)) as {
      authenticated?: unknown;
      dns_records?: unknown;
    } | null;
    if (!body) return { status: 'unavailable', reason: 'brevo unreadable' };
    return {
      status: 'found',
      created,
      authenticated: body.authenticated === true,
      records: readRecords(body.dns_records),
    };
  };

  const guarded = async (
    work: () => Promise<DomainResult>,
  ): Promise<DomainResult> => {
    try {
      return await work();
    } catch (error) {
      const name = error instanceof Error ? error.name : 'error';
      return { status: 'unavailable', reason: `brevo unreachable: ${name}` };
    }
  };

  return {
    // A 400 is either a domain already there or a name refused: the read tells them apart.
    register: (domain) =>
      guarded(async () => {
        const response = await call('', 'POST', { name: domain });
        if (!response.ok && response.status !== 400) {
          return { status: 'unavailable', reason: `brevo ${response.status}` };
        }
        const result = await read(domain, response.ok);
        return result.status === 'notFound' ? { status: 'invalid' } : result;
      }),
    // Authentication answers 400 until the DNS is in place: only the read decides.
    check: (domain) =>
      guarded(async () => {
        const response = await call(`${pathOf(domain)}/authenticate`, 'PUT');
        if (
          [401, 402, 403].includes(response.status) ||
          response.status >= 500
        ) {
          return { status: 'unavailable', reason: `brevo ${response.status}` };
        }
        return read(domain, false);
      }),
    remove: async (domain) => {
      const response = await call(pathOf(domain), 'DELETE');
      if (!response.ok && response.status !== 404) {
        throw new Error(`brevo ${response.status}`);
      }
    },
  };
}
