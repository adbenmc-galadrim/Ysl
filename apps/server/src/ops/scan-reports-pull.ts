import { createHash } from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import {
  SCAN_REPORT_IMAGE_TYPES,
  scanReportId,
  type ScanReportDetail,
  type ScanReportSummary,
} from '@repo/contract/scan-report';

export type Fetch = typeof fetch;

export const DEFAULT_SERVER = 'https://ysl-api.shinseo.fr';

const ROUTE = '/api/scan-reports';
const TIMEOUT_MS = 30_000;
const IMAGE_TIMEOUT_MS = 120_000;
/** The list stops at 100: asked again after the acknowledgements, never forever. */
const MAX_ROUNDS = 50;
const PARTIAL = '.partiel-';

export const REPORT_FILE = 'rapport.json';
export const COMMENT_FILE = 'commentaire.txt';

export type PullOptions = {
  server: string;
  /** Never printed, never written. */
  key: string;
  dir: string;
  fetch?: Fetch;
  signal?: AbortSignal;
  log?: (line: string) => void;
};

export type PulledReport = {
  id: string;
  dir: string;
  /** False when a previous run had already written it (cut before the acknowledgement). */
  written: boolean;
};

export type PullResult = {
  pulled: PulledReport[];
  failed: { id: string; reason: string }[];
};

/** A server answer that stops the pass; `fatal` stops `--watch` too. */
export class PullError extends Error {
  readonly fatal: boolean;
  readonly retryAfterMs: number | undefined;

  constructor(
    message: string,
    {
      fatal = false,
      retryAfterMs,
    }: { fatal?: boolean; retryAfterMs?: number } = {},
  ) {
    super(message);
    this.name = 'PullError';
    this.fatal = fatal;
    this.retryAfterMs = retryAfterMs;
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** The key goes over the wire: only to HTTPS, or to this machine for the demo. */
export function serverBase(server: string): string {
  const url = new URL(server);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new PullError(`Serveur refusé : ${url.origin} n'est pas en HTTPS.`, {
      fatal: true,
    });
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export function retryAfterMs(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (value.trim() !== '' && Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

function httpError(response: Response, what: string): PullError {
  return new PullError(`${what} : HTTP ${response.status}.`, {
    retryAfterMs: retryAfterMs(response.headers.get('retry-after')),
  });
}

async function call(
  options: PullOptions,
  path: string,
  { method = 'GET', timeoutMs = TIMEOUT_MS } = {},
): Promise<Response> {
  const fetchImpl = options.fetch ?? fetch;
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (options.signal) signals.push(options.signal);
  let response: Response;
  try {
    response = await fetchImpl(`${serverBase(options.server)}${ROUTE}${path}`, {
      method,
      headers: { authorization: `Bearer ${options.key}` },
      redirect: 'error',
      signal: AbortSignal.any(signals),
    });
  } catch (error) {
    if (options.signal?.aborted || error instanceof PullError) throw error;
    throw new PullError(`Serveur injoignable (${reason(error)}).`);
  }
  if (response.status === 401) {
    throw new PullError(
      'Clé refusée par le serveur (401) : vérifier SCAN_REPORTS_KEY.',
      { fatal: true },
    );
  }
  return response;
}

async function listReports(options: PullOptions): Promise<ScanReportSummary[]> {
  const response = await call(options, '');
  if (response.status === 404) {
    throw new PullError(
      'Rapports éteints sur le serveur (404) : SCAN_REPORTS_KEY n’y est pas posée.',
    );
  }
  if (!response.ok) throw httpError(response, 'Liste des rapports');
  const list: unknown = await response.json();
  if (!Array.isArray(list)) {
    throw new PullError('Liste des rapports illisible.');
  }
  return list as ScanReportSummary[];
}

function imageName(detail: ScanReportDetail): string {
  return detail.imageType === 'image/png' ? 'image.png' : 'image.jpg';
}

function checkDetail(id: string, detail: ScanReportDetail): string | null {
  if (detail.id !== id) return 'identifiant différent dans le détail';
  if (!SCAN_REPORT_IMAGE_TYPES.includes(detail.imageType)) {
    return `type d'image inconnu (${String(detail.imageType)})`;
  }
  if (!/^[0-9a-f]{64}$/.test(detail.imageSha256)) {
    return 'empreinte de l’image absente';
  }
  return null;
}

/** Written by a previous run, image unchanged: only the acknowledgement is missing. */
async function isIntact(
  target: string,
  detail: ScanReportDetail,
): Promise<boolean> {
  try {
    JSON.parse(await readFile(join(target, REPORT_FILE), 'utf8'));
    const image = await readFile(join(target, imageName(detail)));
    return sha256(image) === detail.imageSha256;
  } catch {
    return false;
  }
}

/** Into a partial folder, read back, then renamed: `<id>/` is whole or absent. */
async function writeReport(
  dir: string,
  detail: ScanReportDetail,
  json: string,
  image: Buffer,
): Promise<string> {
  const target = join(dir, detail.id);
  const partial = join(dir, `.${detail.id}${PARTIAL}${process.pid}`);
  await rm(partial, { recursive: true, force: true });
  try {
    await mkdir(partial);
    await writeFile(join(partial, REPORT_FILE), json, { flush: true });
    await writeFile(join(partial, imageName(detail)), image, { flush: true });
    if (detail.comment) {
      await writeFile(join(partial, COMMENT_FILE), `${detail.comment}\n`, {
        flush: true,
      });
    }
    const written = await readFile(join(partial, imageName(detail)));
    if (sha256(written) !== detail.imageSha256) {
      throw new Error('image relue différente de celle reçue');
    }
    JSON.parse(await readFile(join(partial, REPORT_FILE), 'utf8'));
    await rm(target, { recursive: true, force: true });
    await rename(partial, target);
    return target;
  } catch (error) {
    await rm(partial, { recursive: true, force: true });
    throw error;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** Left by a run cut mid-write; another run still writing keeps its own. */
async function removePartials(dir: string): Promise<void> {
  for (const name of await readdir(dir)) {
    const at = name.lastIndexOf(PARTIAL);
    if (!name.startsWith('.') || at < 0) continue;
    const pid = Number(name.slice(at + PARTIAL.length));
    if (pid === process.pid || !isAlive(pid)) {
      await rm(join(dir, name), { recursive: true, force: true });
    }
  }
}

async function acknowledge(options: PullOptions, id: string): Promise<void> {
  const response = await call(options, `/${id}/ack`, { method: 'POST' });
  if (response.status === 404) return;
  if (!response.ok) throw httpError(response, `Acquittement de ${id}`);
}

type Outcome = { pulled: PulledReport } | { failed: string } | { gone: true };

async function pullOne(
  options: PullOptions,
  summary: ScanReportSummary,
): Promise<Outcome> {
  const parsed = scanReportId.safeParse(summary.id);
  if (!parsed.success) return { failed: 'identifiant invalide' };
  const id = parsed.data;

  const response = await call(options, `/${id}`);
  if (response.status === 404) return { gone: true };
  if (!response.ok) throw httpError(response, `Rapport ${id}`);
  const detail = (await response.json()) as ScanReportDetail;
  const invalid = checkDetail(id, detail);
  if (invalid) return { failed: invalid };
  const json = `${JSON.stringify(detail, null, 2)}\n`;

  const target = join(options.dir, id);
  if (await isIntact(target, detail)) {
    await acknowledge(options, id);
    return { pulled: { id, dir: target, written: false } };
  }

  const file = await call(options, `/${id}/image`, {
    timeoutMs: IMAGE_TIMEOUT_MS,
  });
  if (file.status === 404) return { gone: true };
  if (!file.ok) throw httpError(file, `Image du rapport ${id}`);
  const image = Buffer.from(await file.arrayBuffer());
  if (sha256(image) !== detail.imageSha256) {
    return { failed: 'empreinte de l’image différente de celle du serveur' };
  }

  try {
    await writeReport(options.dir, detail, json, image);
  } catch (error) {
    return { failed: `écriture impossible (${reason(error)})` };
  }
  await acknowledge(options, id);
  return { pulled: { id, dir: target, written: true } };
}

/**
 * Brings every waiting report to `dir/<id>/`, one at a time (the VPS has no
 * swap), and acknowledges each only once it is written and its image checked.
 * A report that fails stays on the server for the next run.
 */
export async function pullReports(options: PullOptions): Promise<PullResult> {
  const log = options.log ?? console.log;
  await mkdir(options.dir, { recursive: true });
  await removePartials(options.dir);

  const result: PullResult = { pulled: [], failed: [] };
  const seen = new Set<string>();
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const todo = (await listReports(options)).filter(
      (summary) => !seen.has(summary.id),
    );
    if (todo.length === 0) break;
    for (const summary of todo) {
      options.signal?.throwIfAborted();
      seen.add(summary.id);
      const outcome = await pullOne(options, summary);
      if ('pulled' in outcome) {
        result.pulled.push(outcome.pulled);
        log(
          outcome.pulled.written
            ? `Rapport ${summary.id} écrit et acquitté : ${outcome.pulled.dir}`
            : `Rapport ${summary.id} déjà présent, acquitté : ${outcome.pulled.dir}`,
        );
      } else if ('failed' in outcome) {
        result.failed.push({ id: String(summary.id), reason: outcome.failed });
        log(`Rapport ${String(summary.id)} non acquitté : ${outcome.failed}.`);
      }
    }
  }
  return result;
}
