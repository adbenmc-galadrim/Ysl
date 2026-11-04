import { parseArgs } from 'node:util';
import { checkGoLive, formatChecks, hasFailure } from '#ops/go-live';

const USAGE = `Usage: pnpm ops:check --api <url de l'API> --web <url de l'app> [--domain <domaine pilote>]
Contrôle en lecture seule d'un déploiement. Avec BREVO_API_KEY dans le terminal,
contrôle aussi le compte Brevo, le webhook et les domaines.`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      api: { type: 'string' },
      web: { type: 'string' },
      domain: { type: 'string' },
    },
  });
  if (!values.api || !values.web) throw new Error(USAGE);

  const checks = await checkGoLive({
    apiUrl: values.api,
    webUrl: values.web,
    brevoApiKey: process.env.BREVO_API_KEY || undefined,
    senderDomain: values.domain,
  });
  console.log(formatChecks(checks));
  if (hasFailure(checks)) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
