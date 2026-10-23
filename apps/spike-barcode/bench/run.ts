import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { matchTracking } from '../src/decode/match.ts';
import { initZxingNode } from '../src/decode/node.ts';
import type { Symbol } from '../src/decode/zxing.ts';
import { loadLabels, openImage, toReadablePath } from './corpus.ts';
import { buildMarkdown, summarize, type Result } from './report.ts';
import { variants } from './variants.ts';

const TWO_D = new Set(['DataMatrix', 'Aztec', 'PDF417', 'QRCode', 'MaxiCode']);

const { values } = parseArgs({
  options: {
    corpus: { type: 'string' },
    private: { type: 'string' },
    out: {
      type: 'string',
      default: join(homedir(), 'goinfre/ysl/tmp/spike-barcode'),
    },
    limit: { type: 'string' },
    variants: { type: 'string' },
  },
});

if (!values.corpus) {
  console.error(
    'usage: pnpm --filter @repo/spike-barcode bench --corpus <dir> [--private <dir>] [--out <dir>] [--limit <n>] [--variants a,b]',
  );
  process.exit(1);
}

const out = resolve(values.out);
const cache = join(out, 'cache');
mkdirSync(out, { recursive: true });

const all = loadLabels({
  corpus: resolve(values.corpus),
  privateDir: values.private ? resolve(values.private) : undefined,
  cache,
});
const limit = values.limit ? Number(values.limit) : null;
const labels =
  limit === null || limit >= all.length
    ? all
    : all.filter(
        (_, i) =>
          Math.floor((i * limit) / all.length) !==
          Math.floor(((i - 1) * limit) / all.length),
      );
const chosen = values.variants?.split(',');
const selected = variants.filter((v) => !chosen || chosen.includes(v.name));

await initZxingNode();

const results: Result[] = [];
const contents = new Map<
  string,
  {
    source: string;
    carrier: string;
    symbols: { format: string; text: string; variants: string[] }[];
  }
>();

const started = performance.now();
for (const [index, label] of labels.entries()) {
  console.error(
    `[${index + 1}/${labels.length}] ${label.id} (${Math.round((performance.now() - started) / 1000)} s)`,
  );
  let image;
  try {
    image = await openImage(toReadablePath(label.path, cache));
  } catch (error) {
    console.error(`  image illisible : ${String(error)}`);
    continue;
  }
  const entry = {
    source: label.source,
    carrier: label.carrier,
    symbols: [] as { format: string; text: string; variants: string[] }[],
  };
  contents.set(label.id, entry);
  for (const variant of selected) {
    const begin = performance.now();
    let symbols: Symbol[] = [];
    let error: string | undefined;
    try {
      symbols = await variant.run(
        image,
        (found) =>
          matchTracking(label.tracking, found, label.carrier).status === 'read',
      );
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const elapsed = performance.now() - begin;
    const match = matchTracking(label.tracking, symbols, label.carrier);
    results.push({
      id: label.id,
      source: label.source,
      carrier: label.carrier,
      variant: variant.name,
      status: match.status,
      seenFormats: [...new Set(symbols.map((s) => s.format))],
      readFormats: match.formats,
      rule: match.rule,
      trackingKnown: label.tracking !== null,
      difficulties: label.difficulties,
      symbols: symbols.length,
      ms: elapsed,
      ...(error ? { error } : {}),
    });
    for (const s of symbols.filter((x) => TWO_D.has(x.format))) {
      const hit = entry.symbols.find(
        (x) => x.format === s.format && x.text === s.text,
      );
      if (hit) hit.variants.push(variant.name);
      else
        entry.symbols.push({
          format: s.format,
          text: s.text,
          variants: [variant.name],
        });
    }
  }
}

const meta = {
  generatedAt: new Date().toISOString().slice(0, 10),
  labels: labels.length,
  bySource: labels.reduce<Record<string, number>>(
    (acc, l) => ({ ...acc, [l.source]: (acc[l.source] ?? 0) + 1 }),
    {},
  ),
  sampled: labels.length < all.length,
  variants: selected.map((v) => ({ name: v.name, description: v.description })),
};

writeFileSync(
  join(out, 'results.json'),
  `${JSON.stringify({ meta, summary: summarize(results), results }, null, 2)}\n`,
);
writeFileSync(join(out, 'results.md'), buildMarkdown(meta, results));
writeFileSync(
  join(out, 'contents-2d.json'),
  `${JSON.stringify(Object.fromEntries(contents), null, 2)}\n`,
);
console.error(`écrit dans ${out} : results.md, results.json, contents-2d.json`);
