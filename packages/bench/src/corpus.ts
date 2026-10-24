import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { readManifest, type Located } from '@repo/corpus/manifest';

export type BenchLabel = Located;

export type CorpusPaths = { corpus: string; privateDir?: string };

const MANIFESTS = ['synthetic/labels.json', 'web/labels.json'];

/** Guide specimens rasterised at 105 ppi: no code is legible, even extracted. */
const LOW_RES_GUIDES = new Set(['colissimo', 'dpd']);

export const loadLabels = ({
  corpus,
  privateDir,
}: CorpusPaths): BenchLabel[] => {
  const labels = MANIFESTS.flatMap((file) => {
    const path = join(corpus, file);
    return existsSync(path) ? readManifest(path) : [];
  });
  if (privateDir) {
    const path = join(privateDir, 'annotations.json');
    if (existsSync(path)) labels.push(...readManifest(path));
  }
  return labels;
};

export const isPdfSpecimen = (label: BenchLabel) =>
  label.origin?.pdf !== undefined && LOW_RES_GUIDES.has(label.carrier);

/** Spreads `limit` labels evenly over the corpus, every source represented. */
export const sample = <T>(items: readonly T[], limit: number | null): T[] => {
  if (limit === null || limit >= items.length) return [...items];
  return items.filter(
    (_, i) =>
      Math.floor((i * limit) / items.length) !==
      Math.floor(((i - 1) * limit) / items.length),
  );
};

export const toReadablePath = (path: string, cache: string) => {
  const ext = extname(path).toLowerCase();
  if (ext !== '.heic' && ext !== '.heif') return path;
  mkdirSync(cache, { recursive: true });
  const key = createHash('sha1').update(readFileSync(path)).digest('hex');
  const target = join(
    cache,
    `${basename(path, extname(path))}-${key.slice(0, 8)}.jpg`,
  );
  if (!existsSync(target)) {
    execFileSync('sips', ['-s', 'format', 'jpeg', path, '--out', target], {
      stdio: 'ignore',
    });
  }
  return target;
};
