import {
  brevoRequest,
  findMailWebhook,
  listMailWebhooks,
  missingEvents,
  WEBHOOK_EVENTS,
  webhookUrl,
} from '#ops/brevo';
import type { Fetch } from '#ops/brevo';

export interface MailWebhookSetup {
  apiUrl: string;
  brevoApiKey: string;
  /** The value of `BREVO_WEBHOOK_TOKEN` on the API; never printed. */
  token: string;
  dryRun?: boolean;
}

export type MailWebhookResult =
  | { action: 'exists'; id: number; url: string }
  | { action: 'incomplete'; id: number; url: string; missing: string[] }
  | { action: 'would-create'; url: string }
  | { action: 'created'; id: number; url: string };

const MIN_TOKEN_LENGTH = 32;

/**
 * Registers the transactional webhook the API listens to, once: an existing
 * one on the same URL is reported, never duplicated nor changed.
 */
export async function ensureMailWebhook(
  setup: MailWebhookSetup,
  fetchImpl: Fetch = fetch,
): Promise<MailWebhookResult> {
  if (setup.token.length < MIN_TOKEN_LENGTH) {
    throw new Error(
      `BREVO_WEBHOOK_TOKEN : ${MIN_TOKEN_LENGTH} caractères au moins, comme sur l'API`,
    );
  }
  const url = webhookUrl(setup.apiUrl);
  const hook = findMailWebhook(
    await listMailWebhooks(fetchImpl, setup.brevoApiKey),
    url,
  );
  if (hook) {
    const missing = missingEvents(hook);
    return missing.length > 0
      ? { action: 'incomplete', id: hook.id, url, missing }
      : { action: 'exists', id: hook.id, url };
  }
  if (setup.dryRun) return { action: 'would-create', url };

  const { id } = await brevoRequest<{ id: number }>(
    fetchImpl,
    setup.brevoApiKey,
    '/webhooks',
    {
      type: 'transactional',
      url,
      description: 'Courrier : statuts des e-mails',
      events: [...WEBHOOK_EVENTS],
      auth: { type: 'bearer', token: setup.token },
    },
  );
  return { action: 'created', id, url };
}

export function describeMailWebhook(result: MailWebhookResult): string {
  switch (result.action) {
    case 'exists':
      return `Webhook déjà déclaré (n° ${result.id}) vers ${result.url}`;
    case 'incomplete':
      return `Webhook n° ${result.id} vers ${result.url} sans : ${result.missing.join(', ')}. À corriger chez Brevo (Transactionnel › Webhooks), ou le supprimer puis relancer.`;
    case 'would-create':
      return `Aucun webhook vers ${result.url} : relancer sans --dry-run pour le créer`;
    case 'created':
      return `Webhook créé (n° ${result.id}) vers ${result.url}`;
  }
}
