import type { Mailer, SendResult } from '#features/mail/mailer';

const ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const SEND_TIMEOUT_MS = 15_000;

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
            sender: from,
            to: [
              {
                email: message.to,
                ...(message.toName ? { name: message.toName } : {}),
              },
            ],
            subject: message.subject,
            textContent: message.text,
            ...(message.html ? { htmlContent: message.html } : {}),
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
