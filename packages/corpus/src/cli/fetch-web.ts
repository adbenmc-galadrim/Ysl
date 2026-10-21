import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { manifestSchema } from '#schema';

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

for (const [i, label] of labels.entries()) {
  const origin = label.origin!;
  const path = join(out, label.file);
  if (!existsSync(path) || sha1(readFileSync(path)) !== origin.sha1) {
    const data = await download(origin.url);
    if (sha1(data) !== origin.sha1) {
      throw new Error(`${label.id} : le fichier a changé sur Commons (sha1)`);
    }
    writeFileSync(path, data);
    await wait(1000);
  }
  process.stdout.write(`\r${i + 1}/${labels.length} ${label.id}    `);
}

writeFileSync(join(out, 'labels.json'), `${JSON.stringify(labels, null, 2)}\n`);
console.log(`\n${labels.length} étiquettes web dans ${out}`);
