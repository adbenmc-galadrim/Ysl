import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { benchRecipients, recipientsMarkdown } from '#recipients';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: resolve(import.meta.dirname, '../out') },
    sizes: { type: 'string', default: '10,100,1000,2000' },
    per: { type: 'string', default: '200' },
  },
});

const out = resolve(values.out);
mkdirSync(out, { recursive: true });
const bench = benchRecipients(
  values.sizes.split(',').map(Number),
  Number(values.per),
);
const markdown = recipientsMarkdown(bench);
writeFileSync(join(out, 'recipients.md'), markdown);
console.log(markdown);
