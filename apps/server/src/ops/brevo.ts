export type Fetch = typeof fetch;

export const BREVO_API = 'https://api.brevo.com/v3';

export const WEBHOOK_PATH = '/api/webhooks/mail';

/** What the receiver reads (`docs/synchronisation.md`), in Brevo's subscription names. */
export const WEBHOOK_EVENTS = [
  'delivered',
  'hardBounce',
  'invalid',
  'blocked',
  'spam',
  'unsubscribed',
] as const;

export const TIMEOUT_MS = 15_000;

export function trimUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export function webhookUrl(apiUrl: string): string {
  return `${trimUrl(apiUrl)}${WEBHOOK_PATH}`;
}

export interface BrevoWebhook {
  id: number;
  url?: string;
  events?: string[];
}

export class BrevoError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
  ) {
    super(`Brevo ${path}: HTTP ${status}`);
  }
}

export async function brevoRequest<T>(
  fetchImpl: Fetch,
  apiKey: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetchImpl(`${BREVO_API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new BrevoError(path, response.status);
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export async function listMailWebhooks(
  fetchImpl: Fetch,
  apiKey: string,
): Promise<BrevoWebhook[]> {
  const { webhooks } = await brevoRequest<{ webhooks?: BrevoWebhook[] }>(
    fetchImpl,
    apiKey,
    '/webhooks?type=transactional',
  );
  return webhooks ?? [];
}

export function missingEvents(hook: BrevoWebhook): string[] {
  const events = hook.events ?? [];
  return WEBHOOK_EVENTS.filter((event) => !events.includes(event));
}

/** Several webhooks may target the URL: a complete one wins. */
export function findMailWebhook(
  hooks: BrevoWebhook[],
  url: string,
): BrevoWebhook | undefined {
  const target = url.toLowerCase();
  const matching = hooks.filter(
    (hook) => trimUrl(hook.url ?? '').toLowerCase() === target,
  );
  return (
    matching.find((hook) => missingEvents(hook).length === 0) ?? matching[0]
  );
}
