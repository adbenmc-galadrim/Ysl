import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DEFAULT_SERVER, pullReports } from '#ops/scan-reports-pull';

const ROOT_DIR = fileURLToPath(
  new URL('../../../../tmp/rapports-scan', import.meta.url),
);
const KEY_FILE = join(homedir(), '.config', 'ysl', 'scan-reports-key');

const USAGE = `Usage : pnpm reports:pull [--server <url>] [--dir <dossier>] [--key-file <fichier>]
Rapatrie les rapports de scan en attente sur le serveur (défaut ${DEFAULT_SERVER})
dans <dossier>/<id>/ (défaut tmp/rapports-scan à la racine du dépôt), puis les acquitte.
Clé : SCAN_REPORTS_KEY dans le terminal, sinon le fichier (défaut ~/.config/ysl/scan-reports-key).`;

async function readKey(keyFile: string | undefined): Promise<string> {
  const fromEnv = process.env.SCAN_REPORTS_KEY?.trim();
  if (fromEnv) return fromEnv;
  const path = keyFile ?? KEY_FILE;
  const fromFile = await readFile(path, 'utf8').then(
    (text) => text.trim(),
    () => '',
  );
  if (!fromFile) {
    throw new Error(
      `Clé absente : poser SCAN_REPORTS_KEY ou l'écrire dans ${path}.\n\n${USAGE}`,
    );
  }
  return fromFile;
}

const controller = new AbortController();

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      server: { type: 'string', default: DEFAULT_SERVER },
      dir: { type: 'string', default: ROOT_DIR },
      'key-file': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }

  process.once('SIGINT', () => {
    console.log('Arrêt demandé : le rapport en cours n’est pas acquitté.');
    controller.abort();
  });

  const result = await pullReports({
    server: values.server,
    key: await readKey(values['key-file']),
    dir: values.dir,
    signal: controller.signal,
  });
  console.log(
    `${result.pulled.length} rapport(s) récupéré(s), ${result.failed.length} en échec.`,
  );
  if (result.failed.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  if (controller.signal.aborted) {
    process.exitCode = 130;
    return;
  }
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
