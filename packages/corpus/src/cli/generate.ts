import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { photograph } from '#synthetic/photo';
import { annotate, plan } from '#synthetic/plan';
import { outDir } from '#cli/output';

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    seed: { type: 'string', default: '20261022' },
    'per-carrier': { type: 'string', default: '12' },
  },
});

const out = join(outDir(values.out), 'synthetic');
mkdirSync(out, { recursive: true });

const seed = Number(values.seed);
const perCarrier = Number(values['per-carrier']);
if (
  !Number.isInteger(seed) ||
  !Number.isInteger(perCarrier) ||
  perCarrier < 1
) {
  console.error(
    '--seed et --per-carrier attendent des entiers, --per-carrier ≥ 1',
  );
  process.exit(1);
}

const planned = plan(seed, perCarrier);
for (const [i, p] of planned.entries()) {
  writeFileSync(join(out, `${p.id}.jpg`), await photograph(p));
  process.stdout.write(`\r${i + 1}/${planned.length} ${p.id}    `);
}
writeFileSync(
  join(out, 'labels.json'),
  `${JSON.stringify(planned.map(annotate), null, 2)}\n`,
);
console.log(`\n${planned.length} étiquettes de synthèse dans ${out}`);
