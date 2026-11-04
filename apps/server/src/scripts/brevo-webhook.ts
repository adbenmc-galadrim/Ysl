import { parseArgs } from 'node:util';
import { describeMailWebhook, ensureMailWebhook } from '#ops/brevo-webhook';

const USAGE = `Usage: pnpm ops:brevo-webhook --api <url de l'API> [--dry-run]
Déclare chez Brevo le webhook des statuts d'e-mail, une seule fois.
BREVO_API_KEY et BREVO_WEBHOOK_TOKEN (la valeur posée sur l'API) dans le terminal.`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      api: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const brevoApiKey = process.env.BREVO_API_KEY;
  const token = process.env.BREVO_WEBHOOK_TOKEN;
  if (!values.api || !brevoApiKey || !token) throw new Error(USAGE);

  const result = await ensureMailWebhook({
    apiUrl: values.api,
    brevoApiKey,
    token,
    dryRun: values['dry-run'],
  });
  console.log(describeMailWebhook(result));
  if (result.action === 'incomplete') process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
