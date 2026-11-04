import {
  brevoRequest,
  findMailWebhook,
  listMailWebhooks,
  missingEvents,
  TIMEOUT_MS,
  trimUrl,
  webhookUrl,
} from '#ops/brevo';
import type { Fetch } from '#ops/brevo';

export type CheckStatus = 'ok' | 'warn' | 'fail';

export interface Check {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface GoLiveTarget {
  apiUrl: string;
  webUrl: string;
  /** Read from the operator's shell; never printed. */
  brevoApiKey?: string;
  /** Pilot company's sender domain, once chosen. */
  senderDomain?: string;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function probe(
  fetchImpl: Fetch,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  return fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

async function checkStatus200(
  fetchImpl: Fetch,
  name: string,
  url: string,
  failure: string,
): Promise<Check> {
  try {
    const response = await probe(fetchImpl, url);
    return response.ok
      ? { name, status: 'ok', detail: `${url} : ${response.status}` }
      : {
          name,
          status: 'fail',
          detail: `${failure} (HTTP ${response.status})`,
        };
  } catch (error) {
    return { name, status: 'fail', detail: `${failure} (${reason(error)})` };
  }
}

async function checkWeb(fetchImpl: Fetch, webUrl: string): Promise<Check> {
  const name = 'Web';
  const url = `${trimUrl(webUrl)}/version.json`;
  try {
    const response = await probe(fetchImpl, url);
    if (!response.ok) {
      return {
        name,
        status: 'fail',
        detail: `${url} : HTTP ${response.status}`,
      };
    }
    const { builtAt } = (await response.json()) as { builtAt?: string };
    return {
      name,
      status: builtAt ? 'ok' : 'warn',
      detail: builtAt ? `construit le ${builtAt}` : 'version.json sans builtAt',
    };
  } catch (error) {
    return { name, status: 'fail', detail: `${url} : ${reason(error)}` };
  }
}

/**
 * The route answers 404 while `BREVO_WEBHOOK_TOKEN` is unset, 401 to a call
 * without the token once it is set: the only outside sign of server mail.
 */
async function checkWebhookRoute(
  fetchImpl: Fetch,
  apiUrl: string,
): Promise<Check> {
  const name = 'Envoi par le serveur';
  try {
    const response = await probe(fetchImpl, webhookUrl(apiUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    if (response.status === 404) {
      return {
        name,
        status: 'warn',
        detail:
          'inactif : BREVO_WEBHOOK_TOKEN absente, les e-mails partent par la messagerie du téléphone',
      };
    }
    if (response.status === 401) {
      return {
        name,
        status: 'ok',
        detail: 'BREVO_WEBHOOK_TOKEN posée (route du webhook protégée)',
      };
    }
    return {
      name,
      status: 'fail',
      detail: `réponse inattendue de la route du webhook : HTTP ${response.status}`,
    };
  } catch (error) {
    return { name, status: 'fail', detail: reason(error) };
  }
}

async function checkBrevo(
  fetchImpl: Fetch,
  target: GoLiveTarget,
  apiKey: string,
): Promise<Check[]> {
  try {
    await brevoRequest(fetchImpl, apiKey, '/account');
  } catch (error) {
    return [
      {
        name: 'Compte Brevo',
        status: 'fail',
        detail: `clé refusée ou Brevo injoignable (${reason(error)})`,
      },
    ];
  }
  const checks: Check[] = [
    { name: 'Compte Brevo', status: 'ok', detail: 'clé acceptée' },
  ];

  const url = webhookUrl(target.apiUrl);
  try {
    const hook = findMailWebhook(
      await listMailWebhooks(fetchImpl, apiKey),
      url,
    );
    const missing = hook ? missingEvents(hook) : [];
    checks.push(
      !hook
        ? {
            name: 'Webhook Brevo',
            status: 'fail',
            detail: `aucun webhook transactionnel vers ${url}`,
          }
        : missing.length > 0
          ? {
              name: 'Webhook Brevo',
              status: 'fail',
              detail: `événements manquants : ${missing.join(', ')}`,
            }
          : {
              name: 'Webhook Brevo',
              status: 'ok',
              detail: `n° ${hook.id} vers ${url}`,
            },
    );
  } catch (error) {
    checks.push({
      name: 'Webhook Brevo',
      status: 'fail',
      detail: reason(error),
    });
  }

  try {
    const { domains = [] } = await brevoRequest<{
      domains?: { domain_name: string; authenticated: boolean }[];
    }>(fetchImpl, apiKey, '/senders/domains');
    const wanted = target.senderDomain?.toLowerCase();
    if (!wanted) {
      checks.push({
        name: 'Domaines Brevo',
        status: 'ok',
        detail:
          domains.length === 0
            ? 'aucun domaine déclaré'
            : domains
                .map(
                  (d) =>
                    `${d.domain_name} ${d.authenticated ? 'authentifié' : 'non authentifié'}`,
                )
                .join(', '),
      });
    } else {
      const domain = domains.find(
        (d) => d.domain_name.toLowerCase() === wanted,
      );
      checks.push(
        !domain
          ? {
              name: 'Domaine pilote',
              status: 'warn',
              detail: `${wanted} non déclaré chez Brevo (Réglages › Expéditeur)`,
            }
          : domain.authenticated
            ? {
                name: 'Domaine pilote',
                status: 'ok',
                detail: `${wanted} authentifié`,
              }
            : {
                name: 'Domaine pilote',
                status: 'fail',
                detail: `${wanted} déclaré, DNS non vérifiés`,
              },
      );
    }
  } catch (error) {
    checks.push({
      name: 'Domaines Brevo',
      status: 'fail',
      detail: reason(error),
    });
  }
  return checks;
}

/** Read-only checks of a deployment, from the operator's machine. */
export async function checkGoLive(
  target: GoLiveTarget,
  fetchImpl: Fetch = fetch,
): Promise<Check[]> {
  const api = trimUrl(target.apiUrl);
  const checks = await Promise.all([
    checkStatus200(fetchImpl, 'API', `${api}/health`, 'API injoignable'),
    checkStatus200(
      fetchImpl,
      'Base de données',
      `${api}/ready`,
      'API sans base',
    ),
    checkWeb(fetchImpl, target.webUrl),
    checkWebhookRoute(fetchImpl, api),
  ]);
  if (!target.brevoApiKey) {
    return [
      ...checks,
      {
        name: 'Brevo',
        status: 'warn',
        detail: 'non contrôlé : BREVO_API_KEY absente de ce terminal',
      },
    ];
  }
  return [
    ...checks,
    ...(await checkBrevo(
      fetchImpl,
      { ...target, apiUrl: api },
      target.brevoApiKey,
    )),
  ];
}

const MARK: Record<CheckStatus, string> = { ok: '✓', warn: '!', fail: '✗' };

export function formatChecks(checks: Check[]): string {
  return checks
    .map((check) => `${MARK[check.status]} ${check.name} — ${check.detail}`)
    .join('\n');
}

export function hasFailure(checks: Check[]): boolean {
  return checks.some((check) => check.status === 'fail');
}
