import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { initZxingNode } from '@repo/barcode/node';
import { loadLabels, sample, toReadablePath } from '#corpus';
import { type BenchImage, openImage } from '#image';
import type { LabelResult } from '#metrics';
import { buildMarkdown, buildMismatches, type Meta } from '#report';
import { type Contents2d, POLICIES, type Policy, runLabel } from '#run';

const { values } = parseArgs({
  options: {
    corpus: { type: 'string' },
    private: { type: 'string' },
    out: { type: 'string', default: join(homedir(), 'goinfre/ysl/tmp/bench') },
    limit: { type: 'string' },
    policy: { type: 'string', default: POLICIES.join(',') },
    raw: { type: 'boolean', default: false },
  },
});

const policies = values.policy
  .split(',')
  .filter((p): p is Policy => (POLICIES as readonly string[]).includes(p));

if (!values.corpus || policies.length === 0) {
  console.error(
    'usage: pnpm --filter @repo/bench measure --corpus <dir> [--private <dir>] [--out <dir>] [--limit <n>] [--policy first,thorough] [--raw]',
  );
  process.exit(1);
}

const out = resolve(values.out);
const cache = join(out, 'cache');
mkdirSync(out, { recursive: true });

const all = loadLabels({
  corpus: resolve(values.corpus),
  privateDir: values.private ? resolve(values.private) : undefined,
});
const labels = sample(all, values.limit ? Number(values.limit) : null);

await initZxingNode();

const results: LabelResult[] = [];
const contents: Contents2d = {};
const started = performance.now();

for (const [index, label] of labels.entries()) {
  const elapsed = Math.round((performance.now() - started) / 1000);
  console.error(`[${index + 1}/${labels.length}] ${label.id} (${elapsed} s)`);
  let image: BenchImage | null = null;
  try {
    image = await openImage(toReadablePath(label.path, cache), {
      viewfinder: !values.raw,
    });
  } catch (error) {
    console.error(`  image illisible : ${String(error)}`);
  }
  for (const policy of policies) {
    results.push(await runLabel(label, image, policy, contents));
  }
}

const meta: Meta = {
  generatedAt: new Date().toISOString().slice(0, 10),
  corpus: labels.reduce<Record<string, number>>(
    (acc, l) => ({ ...acc, [l.source]: (acc[l.source] ?? 0) + 1 }),
    {},
  ),
  policies,
  viewfinder: !values.raw,
  sampled: labels.length < all.length,
  unreviewed: labels.filter((l) => !l.reviewed).length,
};

writeFileSync(
  join(out, 'results.json'),
  `${JSON.stringify({ meta, results }, null, 2)}\n`,
);
writeFileSync(join(out, 'results.md'), buildMarkdown(meta, results));
writeFileSync(join(out, 'mismatches.md'), buildMismatches(results));
writeFileSync(
  join(out, 'contents-2d.json'),
  `${JSON.stringify(contents, null, 2)}\n`,
);
console.error(
  `écrit dans ${out} : results.md, mismatches.md, results.json, contents-2d.json`,
);
