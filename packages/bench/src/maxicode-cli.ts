import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { type Raster, readMaxiCode, readSymbols } from '@repo/barcode';
import { initZxingNode } from '@repo/barcode/node';
import { parseCode } from '@repo/contract/codes';
import { loadLabels, toReadablePath } from '#corpus';
import { openImage } from '#image';

const { values } = parseArgs({
  options: {
    corpus: { type: 'string' },
    private: { type: 'string' },
    cache: {
      type: 'string',
      default: resolve(import.meta.dirname, '../out/cache'),
    },
  },
});

if (!values.corpus) {
  console.error(
    'usage: pnpm --filter @repo/bench maxicode --corpus <dir> [--private <dir>]',
  );
  process.exit(1);
}

const readers: Record<string, (raster: Raster) => Promise<string | null>> = {
  'zxing, image entière': async (raster) =>
    (await readSymbols(raster, { formats: ['MaxiCode'] }))[0]?.text ?? null,
  'zxing + recadrage maison': async (raster) =>
    (
      await readMaxiCode(raster, (crop) =>
        readSymbols(crop, { formats: ['MaxiCode'], isPure: true }),
      )
    )?.symbols[0]?.text ?? null,
};

const labels = loadLabels({
  corpus: resolve(values.corpus),
  privateDir: values.private ? resolve(values.private) : undefined,
}).filter((label) => label.carrier === 'ups');

await initZxingNode();

const counts = new Map<string, number>();
const totals = new Map<string, number>();
for (const label of labels) {
  const image = await openImage(toReadablePath(label.path, values.cache));
  const raster = image.source.raster(Infinity);
  totals.set(label.source, (totals.get(label.source) ?? 0) + 1);
  for (const [name, read] of Object.entries(readers)) {
    const text = await read(raster);
    const right =
      text !== null &&
      parseCode(text, 'MaxiCode')?.trackings.some(
        (t) => t.value === label.tracking,
      ) === true;
    if (!right) continue;
    const key = `${name}|${label.source}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
}

for (const name of Object.keys(readers)) {
  const cells = [...totals].map(
    ([source, total]) =>
      `${source} ${counts.get(`${name}|${source}`) ?? 0}/${total}`,
  );
  console.log(`${name} : ${cells.join(', ')}`);
}
