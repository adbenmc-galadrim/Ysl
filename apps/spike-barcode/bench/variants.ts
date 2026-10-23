import { readMaxiCode } from '../src/decode/maxicode.ts';
import { readTiles } from '../src/decode/tiles.ts';
import { readSymbols, type Raster, type Symbol } from '../src/decode/zxing.ts';
import type { BenchImage } from './corpus.ts';

export type Oracle = (symbols: Symbol[]) => boolean;

export type Variant = {
  name: string;
  description: string;
  run: (image: BenchImage, found: Oracle) => Promise<Symbol[]>;
};

const readAll = (raster: Raster) => readSymbols(raster);

const readMaxiOnly = (raster: Raster) =>
  readSymbols(raster, { formats: ['MaxiCode'] });

const readMaxiPure = (raster: Raster) =>
  readSymbols(raster, { formats: ['MaxiCode'], isPure: true });

const merge = (...lists: Symbol[][]) => {
  const seen = new Set<string>();
  return lists.flat().filter((s) => {
    const key = `${s.format}\u0000${s.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const cascade = async (image: BenchImage, found: Oracle) => {
  let symbols: Symbol[] = [];
  const steps: (() => Promise<Symbol[]>)[] = [
    async () => readAll(await image.resized(1600)),
    async () => readAll(await image.resized(2400)),
    () => readTiles(image.raster, readAll),
    async () => (await readMaxiCode(image.raster, readMaxiPure))?.symbols ?? [],
  ];
  for (const step of steps) {
    symbols = merge(symbols, await step());
    if (found(symbols)) break;
  }
  return symbols;
};

export const variants: Variant[] = [
  {
    name: 'entiere-1600',
    description: 'image entière réduite à 1 600 px (grand côté)',
    run: async (image) => readAll(await image.resized(1600)),
  },
  {
    name: 'entiere-2400',
    description: 'image entière réduite à 2 400 px (grand côté)',
    run: async (image) => readAll(await image.resized(2400)),
  },
  {
    name: 'pleine-resolution',
    description: 'image entière en pleine résolution, un seul appel',
    run: (image) => readAll(image.raster),
  },
  {
    name: 'tuiles',
    description: 'tuiles pleine résolution de 2 048 px, recouvrement 512 px',
    run: (image) => readTiles(image.raster, readAll),
  },
  {
    name: 'maxicode-sans-recadrage',
    description: 'MaxiCode seul, image réduite à 2 400 px, sans recadrage',
    run: async (image) => readMaxiOnly(await image.resized(2400)),
  },
  {
    name: 'maxicode-recadre',
    description: 'MaxiCode seul, recadrage maison puis lecture pure',
    run: async (image) =>
      (await readMaxiCode(image.raster, readMaxiPure))?.symbols ?? [],
  },
  {
    name: 'viseur-cascade',
    description:
      'viseur simulé (3024×4032, JPEG 0,8) : entière 1 600 px, 2 400 px, tuiles, MaxiCode recadré ; arrêt dès que le tracking est lu',
    run: async (image, found) => cascade(await image.viewfinder(), found),
  },
];
