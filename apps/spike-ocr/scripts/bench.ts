import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { cpus, homedir, tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { manifestSchema, type Label, type Source } from '@repo/corpus/schema';
import { chromium, webkit, type Browser } from 'playwright';
import { build, preview } from 'vite';
import { ENGINE_CONFIGS } from '../src/engines/configs.ts';
import { seriesStats } from '../src/metrics/stats.ts';
import type { PhotoResult, SeriesResult } from '../src/metrics/types.ts';
import { buildDirectory } from '../src/scoring/directory.ts';
import {
  accuracyOf,
  scorePhoto,
  type PhotoScore,
  type Accuracy,
} from '../src/scoring/scoring.ts';

type SpikeWindow = {
  spikeOcr: {
    start: (request: unknown) => Promise<SeriesResult[]>;
    observe: (
      observer: (record: { name: string }, lines: unknown) => void,
    ) => void;
  };
  benchLines: (name: string, lines: { text: string }[]) => void;
};

type Entry = { source: Source; label: Label; path: string; name: string };

const { values } = parseArgs({
  options: {
    corpus: {
      type: 'string',
      default: join(homedir(), 'goinfre/ysl/tmp/corpus'),
    },
    out: {
      type: 'string',
      default: join(homedir(), 'goinfre/ysl/tmp/spike-ocr'),
    },
    browsers: { type: 'string', default: 'webkit,chromium' },
    configs: { type: 'string', default: 'all' },
    sources: { type: 'string', default: 'synthetic,web,real' },
    limit: { type: 'string' },
    'no-build': { type: 'boolean', default: false },
  },
});

const root = resolve(import.meta.dirname, '..');
const corpus = resolve(values.corpus);
const out = resolve(values.out);
const limit = values.limit ? Number(values.limit) : undefined;
const sources = values.sources.split(',') as Source[];
const configIds =
  values.configs === 'all'
    ? ENGINE_CONFIGS.map((config) => config.id)
    : values.configs.split(',');
const browserNames = values.browsers.split(',');
const LABEL_FILES: Record<Source, string> = {
  synthetic: 'labels.json',
  web: 'labels.json',
  real: 'annotations.json',
};

function loadEntries(scratch: string): Entry[] {
  const entries: Entry[] = [];
  for (const source of sources) {
    const labels = manifestSchema.parse(
      JSON.parse(
        readFileSync(join(corpus, source, LABEL_FILES[source]), 'utf8'),
      ),
    );
    for (const label of limit ? labels.slice(0, limit) : labels) {
      const original = join(corpus, source, label.file);
      if (!existsSync(original)) continue;
      let path = original;
      if (extname(original).toLowerCase() === '.heic') {
        path = join(scratch, `${basename(original, extname(original))}.jpg`);
        execFileSync(
          'sips',
          ['-s', 'format', 'jpeg', original, '--out', path],
          {
            stdio: 'ignore',
          },
        );
      }
      entries.push({ source, label, path, name: basename(path) });
    }
  }
  return entries;
}

function directories(entries: readonly Entry[]): Record<Source, string[]> {
  const result = {} as Record<Source, string[]>;
  for (const source of sources) {
    result[source] = buildDirectory([
      ...new Set(
        entries.flatMap((entry) =>
          entry.source === source && entry.label.recipient
            ? [entry.label.recipient]
            : [],
        ),
      ),
    ]);
  }
  return result;
}

async function launch(name: string): Promise<Browser> {
  if (name === 'webkit') return webkit.launch();
  return chromium.launch({
    channel: 'chromium',
    args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
  });
}

type Cell = {
  browser: string;
  configId: string;
  label: string;
  outcome: SeriesResult['outcome'];
  detail?: string;
  loadMs?: number;
  modelBytes?: number;
  threads?: number;
  photos: PhotoResult[];
  perSource: Partial<Record<Source, Accuracy>>;
  perCarrier: Record<string, Accuracy>;
  overall: Accuracy;
};

function withoutText(score: PhotoScore): PhotoScore {
  return {
    ...(score.recipient && {
      recipient: { correct: score.recipient.correct, top: [] },
    }),
    ...(score.sender && { sender: score.sender }),
  };
}

function scoreCell(
  browser: string,
  result: SeriesResult,
  entries: readonly Entry[],
  dirs: Record<Source, string[]>,
  texts: ReadonlyMap<string, string[]>,
): Cell {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const scored: { entry: Entry; score: ReturnType<typeof scorePhoto> }[] = [];
  const photos = result.photos.map((photo) => {
    const entry = byName.get(photo.name);
    if (!entry) return photo;
    const score = scorePhoto(
      entry.label,
      photo.ok ? texts.get(photo.name) : undefined,
      dirs[entry.source],
    );
    scored.push({ entry, score });
    // Real photos keep only right/wrong: no OCR text and no directory name.
    const kept: PhotoResult = {
      ...photo,
      score: entry.source === 'real' ? withoutText(score) : score,
    };
    return kept;
  });
  const missing = entries.filter(
    (entry) => !result.photos.some((photo) => photo.name === entry.name),
  );
  for (const entry of missing) {
    scored.push({
      entry,
      score: scorePhoto(entry.label, undefined, dirs[entry.source]),
    });
  }
  const perSource: Cell['perSource'] = {};
  for (const source of sources) {
    perSource[source] = accuracyOf(
      scored
        .filter((item) => item.entry.source === source)
        .map((item) => item.score),
    );
  }
  const perCarrier: Cell['perCarrier'] = {};
  for (const carrier of new Set(
    scored.map((item) => item.entry.label.carrier),
  )) {
    perCarrier[carrier] = accuracyOf(
      scored
        .filter((item) => item.entry.label.carrier === carrier)
        .map((item) => item.score),
    );
  }
  return {
    browser,
    configId: result.configId,
    label: result.label,
    outcome: result.outcome,
    detail: result.detail,
    loadMs: result.loadMs,
    modelBytes: result.modelBytes,
    threads: result.threads,
    photos,
    perSource,
    perCarrier,
    overall: accuracyOf(scored.map((item) => item.score)),
  };
}

const pct = (rate: number | undefined) =>
  rate === undefined ? '–' : `${Math.round(rate * 100)} %`;
const num = (value: number | undefined) =>
  value === undefined ? '–' : String(Math.round(value));
const mb = (value: number | undefined) =>
  value === undefined ? '–' : String(Math.round(value / 1_048_576));

function fraction(accuracy: Accuracy | undefined) {
  if (!accuracy) return '–';
  return `${pct(accuracy.recipient.rate)} (${accuracy.recipient.correct}/${accuracy.recipient.total}) · ${pct(accuracy.sender.rate)} (${accuracy.sender.correct}/${accuracy.sender.total})`;
}

function report(
  cells: readonly Cell[],
  entries: readonly Entry[],
  versions: Record<string, string>,
  seconds: number,
): string {
  const lines: string[] = [];
  const count = (source: Source) =>
    entries.filter((entry) => entry.source === source).length;
  lines.push('# Banc OCR sur le Mac (YSL-12, spike S3)', '');
  lines.push(
    `- Date : ${new Date().toISOString()}`,
    `- Machine : ${cpus()[0]?.model ?? '?'} (${cpus().length} cœurs)`,
    `- Navigateurs : ${Object.entries(versions)
      .map(([name, version]) => `${name} ${version}`)
      .join(', ')}`,
    `- Corpus : ${sources.map((source) => `${source} ${count(source)}`).join(', ')} photos${limit ? ` (limité à ${limit} par source)` : ''}`,
    `- Durée du banc : ${Math.round(seconds / 60)} min`,
    '- Les temps du Mac ne valent pas pour l’iPhone : seule l’exactitude compte. Chaque configuration tourne dans une page neuve. Les photos réelles (HEIC) sont converties en JPEG par `sips` ; leur texte n’est pas conservé.',
    '- Chaque case d’exactitude : destinataire top 3 (justes/évaluées) · expéditeur (justes/évaluées).',
    '',
  );
  for (const browser of browserNames) {
    const rows = cells.filter((cell) => cell.browser === browser);
    lines.push(`## ${browser}`, '', '### Exactitude par source', '');
    lines.push(`| Configuration | Issue | ${sources.join(' | ')} | Tout |`);
    lines.push(`|---|---|${sources.map(() => '---').join('|')}|---|`);
    for (const cell of rows) {
      lines.push(
        `| ${cell.label} | ${cell.outcome}${cell.detail ? ` : ${cell.detail}` : ''} | ${sources.map((source) => fraction(cell.perSource[source])).join(' | ')} | ${fraction(cell.overall)} |`,
      );
    }
    lines.push('', '### Temps et mémoire', '');
    lines.push(
      '| Configuration | Chargement ms | p50 ms | p95 ms | max ms | Tas WASM max Mo | Échecs | Photos |',
    );
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const cell of rows) {
      const stats = seriesStats(cell.photos);
      lines.push(
        `| ${cell.label} | ${num(cell.loadMs)} | ${num(stats.total.p50)} | ${num(stats.total.p95)} | ${num(stats.total.max)} | ${mb(stats.maxWasmHeapBytes)} | ${stats.failures} | ${stats.photos} |`,
      );
    }
    const carriers = [
      ...new Set(entries.map((entry) => entry.label.carrier)),
    ].sort();
    lines.push('', '### Par transporteur (toutes sources)', '');
    lines.push(
      `| Transporteur | ${rows.map((cell) => cell.label).join(' | ')} |`,
    );
    lines.push(`|---|${rows.map(() => '---').join('|')}|`);
    for (const carrier of carriers) {
      lines.push(
        `| ${carrier} | ${rows.map((cell) => fraction(cell.perCarrier[carrier])).join(' | ')} |`,
      );
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

const scratch = mkdtempSync(join(tmpdir(), 'spike-ocr-bench-'));
const started = Date.now();
try {
  if (!values['no-build'] || !existsSync(join(root, 'dist'))) {
    await build({ root, logLevel: 'warn' });
  }
  const entries = loadEntries(scratch);
  const dirs = directories(entries);
  const server = await preview({ root, logLevel: 'warn' });
  const url = `http://127.0.0.1:3106${server.config.base}`;
  const cells: Cell[] = [];
  const versions: Record<string, string> = {};
  try {
    for (const name of browserNames) {
      const browser = await launch(name);
      versions[name] = browser.version();
      for (const configId of configIds) {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
        });
        const page = await context.newPage();
        const tick = Date.now();
        try {
          await page.goto(url);
          await page.waitForFunction(() =>
            document
              .querySelector('[data-testid=pack]')
              ?.textContent?.includes('photos'),
          );
          const texts = new Map<string, string[]>();
          await page.exposeFunction(
            'benchLines',
            (photoName: string, lines: { text: string }[]) =>
              void texts.set(
                photoName,
                lines.map((line) => line.text),
              ),
          );
          await page.evaluate(() =>
            (window as unknown as SpikeWindow).spikeOcr.observe(
              (record, lines) =>
                (window as unknown as SpikeWindow).benchLines(
                  record.name,
                  lines as { text: string }[],
                ),
            ),
          );
          await page.setInputFiles(
            'input[type=file]',
            entries.map((entry) => entry.path),
          );
          const results = await page.evaluate(
            (id): Promise<SeriesResult[]> =>
              (window as unknown as SpikeWindow).spikeOcr.start({
                configIds: [id],
                source: 'import',
                count: 0,
              }),
            configId,
          );
          for (const result of results) {
            const cell = scoreCell(name, result, entries, dirs, texts);
            cells.push(cell);
            console.log(
              `${name} ${configId} ${result.outcome} ${Math.round((Date.now() - tick) / 1000)} s · dest ${pct(cell.overall.recipient.rate)} · exp ${pct(cell.overall.sender.rate)}`,
            );
          }
        } catch (error) {
          console.log(`${name} ${configId} erreur du banc : ${String(error)}`);
          cells.push({
            browser: name,
            configId,
            label: configId,
            outcome: 'crashed',
            detail: String(error).slice(0, 200),
            photos: [],
            perSource: {},
            perCarrier: {},
            overall: accuracyOf([]),
          });
        } finally {
          await context.close();
        }
      }
      await browser.close();
    }
  } finally {
    await server.close();
  }
  mkdirSync(out, { recursive: true });
  const seconds = (Date.now() - started) / 1000;
  writeFileSync(
    join(out, 'banc-mac.json'),
    JSON.stringify({ versions, cells }, null, 2),
  );
  writeFileSync(
    join(out, 'banc-mac.md'),
    report(cells, entries, versions, seconds),
  );
  console.log(`rapport dans ${join(out, 'banc-mac.md')}`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
