import { readMaxiCode } from '#maxicode';
import { dedupeSymbols, readTiles, type RasterReader } from '#tiles';
import { readSymbols, type Raster, type Symbol } from '#zxing';

export type StepName = 'whole-1600' | 'whole-2400' | 'tiles' | 'maxicode';

export type Step = {
  name: StepName;
  ms: number;
  symbols: number;
  width: number;
  height: number;
};

export type DecodeResult = {
  symbols: Symbol[];
  steps: Step[];
  width: number;
  height: number;
  totalMs: number;
};

export type DecodeOptions = {
  enough?: (symbols: Symbol[]) => boolean;
  thorough?: boolean;
};

export type RasterSource = {
  width: number;
  height: number;
  raster: (maxSide: number) => Raster;
};

export type CascadeReaders = {
  all: RasterReader;
  maxicode: RasterReader;
};

const defaultReaders: CascadeReaders = {
  all: (raster) => readSymbols(raster),
  maxicode: (raster) =>
    readSymbols(raster, { formats: ['MaxiCode'], isPure: true }),
};

export const enoughFormats =
  (formats: readonly string[]) =>
  (symbols: Symbol[]): boolean =>
    formats.every((format) => symbols.some((s) => s.format === format));

const WHOLE_SIDES = [
  ['whole-1600', 1600],
  ['whole-2400', 2400],
] as const;

export const rescale = (symbols: Symbol[], scale: number): Symbol[] => {
  if (scale === 1) return symbols;
  const move = (p: { x: number; y: number }) => ({
    x: p.x * scale,
    y: p.y * scale,
  });
  return symbols.map((s) => ({
    ...s,
    position: {
      topLeft: move(s.position.topLeft),
      topRight: move(s.position.topRight),
      bottomRight: move(s.position.bottomRight),
      bottomLeft: move(s.position.bottomLeft),
    },
  }));
};

export const decodeSource = async (
  source: RasterSource,
  {
    enough = (found) => found.length > 0,
    thorough = false,
  }: DecodeOptions = {},
  readers: CascadeReaders = defaultReaders,
): Promise<DecodeResult> => {
  const startedAt = performance.now();
  const steps: Step[] = [];
  let symbols: Symbol[] = [];

  const record = async (
    name: StepName,
    raster: Raster,
    run: () => Promise<Symbol[]>,
  ) => {
    const t0 = performance.now();
    const found = rescale(await run(), source.width / raster.width);
    steps.push({
      name,
      ms: performance.now() - t0,
      symbols: found.length,
      width: raster.width,
      height: raster.height,
    });
    symbols = dedupeSymbols([...symbols, ...found]);
  };
  const done = () => !thorough && enough(symbols);

  for (const [name, side] of WHOLE_SIDES) {
    if (done()) break;
    if (
      name === 'whole-2400' &&
      Math.max(source.width, source.height) <= 1600
    ) {
      continue;
    }
    const raster = source.raster(side);
    await record(name, raster, () => readers.all(raster));
  }

  let full: Raster | null = null;
  const fullRaster = () => (full ??= source.raster(Infinity));

  if (!done()) {
    const raster = fullRaster();
    await record('tiles', raster, () => readTiles(raster, readers.all));
  }

  const hasMaxiCode = symbols.some((s) => s.format === 'MaxiCode');
  if (!done() && !hasMaxiCode) {
    const raster = fullRaster();
    await record(
      'maxicode',
      raster,
      async () => (await readMaxiCode(raster, readers.maxicode))?.symbols ?? [],
    );
  }

  return {
    symbols,
    steps,
    width: source.width,
    height: source.height,
    totalMs: performance.now() - startedAt,
  };
};
