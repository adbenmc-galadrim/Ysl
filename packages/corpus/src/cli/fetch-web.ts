import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';
import { manifestSchema, type Label } from '#schema';

const root = resolve(import.meta.dirname, '../..');
const out = join(root, 'out/web');
mkdirSync(out, { recursive: true });

const labels = manifestSchema.parse(
  JSON.parse(readFileSync(join(root, 'data/web.json'), 'utf8')),
);

const sha1 = (data: Buffer) => createHash('sha1').update(data).digest('hex');

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

const download = async (url: string) => {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ysl-corpus/0.1 (github.com/adbenmc-galadrim/Ysl)',
      },
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (attempt === 6) throw new Error(`${url} : HTTP ${response.status}`);
    const retryAfter = Number(response.headers.get('retry-after'));
    await wait(retryAfter > 0 ? retryAfter * 1000 : attempt * 5000);
  }
};

const cache = join(out, 'sources');
mkdirSync(cache, { recursive: true });

const source = async (url: string, expected: string) => {
  const path = join(cache, expected);
  if (existsSync(path) && sha1(readFileSync(path)) === expected) return path;
  const data = await download(url);
  if (sha1(data) !== expected) {
    throw new Error(`${url} : le fichier a changé à la source (sha1)`);
  }
  writeFileSync(path, data);
  await wait(1000);
  return path;
};

const renderPdf = async (
  file: string,
  { page, crop }: NonNullable<NonNullable<Label['origin']>['pdf']>,
) => {
  const prefix = join(cache, `${basename(file)}-${page}`);
  execFileSync('pdftoppm', [
    '-r',
    '200',
    '-f',
    String(page),
    '-l',
    String(page),
    '-png',
    '-singlefile',
    file,
    prefix,
  ]);
  const image = sharp(`${prefix}.png`);
  const { width = 0, height = 0 } = await image.metadata();
  return image
    .extract({
      left: Math.round(crop.left * width),
      top: Math.round(crop.top * height),
      width: Math.min(
        Math.round(crop.width * width),
        width - Math.round(crop.left * width),
      ),
      height: Math.min(
        Math.round(crop.height * height),
        height - Math.round(crop.top * height),
      ),
    })
    .png()
    .toBuffer();
};

for (const [i, label] of labels.entries()) {
  const origin = label.origin!;
  const path = join(out, label.file);
  const file = await source(origin.url, origin.sha1);
  writeFileSync(
    path,
    origin.pdf ? await renderPdf(file, origin.pdf) : readFileSync(file),
  );
  process.stdout.write(`\r${i + 1}/${labels.length} ${label.id}    `);
}

writeFileSync(join(out, 'labels.json'), `${JSON.stringify(labels, null, 2)}\n`);
console.log(`\n${labels.length} étiquettes web dans ${out}`);
