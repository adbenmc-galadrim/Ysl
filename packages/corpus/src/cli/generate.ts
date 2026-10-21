import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { photograph } from '#synthetic/photo';
import { annotate, plan } from '#synthetic/plan';

const { values } = parseArgs({
  options: {
    seed: { type: 'string', default: '20261022' },
    'per-carrier': { type: 'string', default: '12' },
  },
});

const out = resolve(import.meta.dirname, '../../out/synthetic');
mkdirSync(out, { recursive: true });

const planned = plan(Number(values.seed), Number(values['per-carrier']));
for (const [i, p] of planned.entries()) {
  writeFileSync(join(out, `${p.id}.jpg`), await photograph(p));
  process.stdout.write(`\r${i + 1}/${planned.length} ${p.id}    `);
}
writeFileSync(
  join(out, 'labels.json'),
  `${JSON.stringify(planned.map(annotate), null, 2)}\n`,
);
console.log(`\n${planned.length} étiquettes de synthèse dans ${out}`);
