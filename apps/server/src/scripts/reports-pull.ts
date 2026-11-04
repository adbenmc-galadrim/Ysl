import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  DEFAULT_SERVER,
  MIN_INTERVAL_MS,
  pullReports,
  runHook,
  WATCH_INTERVAL_MS,
  watchReports,
} from '#ops/scan-reports-pull';

const ROOT_DIR = fileURLToPath(
  new URL('../../../../tmp/rapports-scan', import.meta.url),
);
const KEY_FILE = join(homedir(), '.config', 'ysl', 'scan-reports-key');

const USAGE = `Usage : pnpm reports:pull [--watch [--interval <secondes>]] [--on-report <commande>]
                         [--server <url>] [--dir <dossier>] [--key-file <fichier>]
Rapatrie les rapports de scan en attente sur le serveur (défaut ${DEFAULT_SERVER})
dans <dossier>/<id>/ (défaut tmp/rapports-scan à la racine du dépôt), puis les acquitte.
--watch recommence toutes les ${WATCH_INTERVAL_MS / 1000} s (${MIN_INTERVAL_MS / 1000} s au moins), jusqu'à Ctrl-C.
--on-report lance la commande (sh -c) après chaque rapport acquitté, avec
SCAN_REPORT_ID et SCAN_REPORT_DIR dans son environnement.
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
      watch: { type: 'boolean', default: false },
      interval: { type: 'string' },
      'on-report': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }

  const seconds =
    values.interval === undefined ? undefined : Number(values.interval);
  if (seconds !== undefined && !(seconds > 0)) {
    throw new Error(`--interval invalide : ${values.interval}\n\n${USAGE}`);
  }
  const command = values['on-report'];

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      console.log('Arrêt demandé : le rapport en cours n’est pas acquitté.');
      controller.abort();
    });
  }

  const options = {
    server: values.server,
    key: await readKey(values['key-file']),
    dir: values.dir,
    signal: controller.signal,
    onReport: command
      ? (report: Parameters<typeof runHook>[1]) => runHook(command, report)
      : undefined,
  };
  if (values.watch) {
    console.log(`Suivi de ${options.server}, Ctrl-C pour arrêter.`);
    await watchReports({
      ...options,
      intervalMs: seconds === undefined ? undefined : seconds * 1000,
    });
    console.log('Arrêté.');
    return;
  }

  const result = await pullReports(options);
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
