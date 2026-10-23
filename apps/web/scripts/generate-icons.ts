import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const publicDir = resolve(import.meta.dirname, '../public');
const sizes = {
  'apple-touch-icon.png': 180,
  'icon-192.png': 192,
  'icon-512.png': 512,
};

const svg = await readFile(resolve(publicDir, 'icon.svg'));

for (const [file, size] of Object.entries(sizes)) {
  const png = await sharp(svg, { density: 72 * (size / 512) * 4 })
    .resize(size, size)
    .flatten({ background: '#000000' })
    .png()
    .toBuffer();
  await writeFile(resolve(publicDir, file), png);
}
