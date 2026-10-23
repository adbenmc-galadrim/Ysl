import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { readMaxiCode } from '#/decode/maxicode';
import { MAX_CANVAS_PIXELS, dedupeSymbols, readTiles } from '#/decode/tiles';
import {
  initZxing,
  readSymbols,
  type Raster,
  type Symbol,
} from '#/decode/zxing';
import type {
  DecodeOptions,
  DecodeResult,
  Step,
  StepName,
  WorkerRequest,
  WorkerResponse,
} from '#/worker/protocol';

const readAll = (raster: Raster) => readSymbols(raster);

const readMaxiPure = (raster: Raster) =>
  readSymbols(raster, { formats: ['MaxiCode'], isPure: true });

const loadZxing = async () => {
  try {
    await initZxing({ wasmUrl });
  } catch {
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error(`wasm: HTTP ${response.status}`);
    await initZxing({ wasmBinary: await response.arrayBuffer() });
  }
};

let loading: Promise<void> | null = null;

const ensureZxing = () => (loading ??= loadZxing());

const rasterOf = (
  bitmap: ImageBitmap,
  maxSide: number,
): { raster: Raster; scale: number } => {
  const longest = Math.max(bitmap.width, bitmap.height);
  const byPixels = Math.sqrt(
    MAX_CANVAS_PIXELS / (bitmap.width * bitmap.height),
  );
  const factor = Math.min(1, maxSide / longest, byPixels);
  const width = Math.max(1, Math.floor(bitmap.width * factor));
  const height = Math.max(1, Math.floor(bitmap.height * factor));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D indisponible');
  context.drawImage(bitmap, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  return { raster: { data, width, height }, scale: bitmap.width / width };
};

const rescale = (symbols: Symbol[], scale: number): Symbol[] => {
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

const decode = async (
  bitmap: ImageBitmap,
  { forceMaxiCode, exhaustive }: DecodeOptions,
): Promise<DecodeResult> => {
  const startedAt = performance.now();
  const steps: Step[] = [];
  let symbols: Symbol[] = [];
  let winner: StepName | null = null;

  const record = async (
    name: StepName,
    width: number,
    height: number,
    run: () => Promise<Symbol[]>,
  ) => {
    const t0 = performance.now();
    const found = await run();
    steps.push({
      name,
      ms: performance.now() - t0,
      symbols: found.length,
      width,
      height,
    });
    if (found.length > 0) {
      winner ??= name;
      symbols = dedupeSymbols([...symbols, ...found]);
    }
  };
  const done = () => symbols.length > 0 && !exhaustive;

  for (const [name, side] of [
    ['whole-1600', 1600],
    ['whole-2400', 2400],
  ] as const) {
    if (done()) break;
    if (
      name === 'whole-2400' &&
      Math.max(bitmap.width, bitmap.height) <= 1600
    ) {
      continue;
    }
    const { raster, scale } = rasterOf(bitmap, side);
    await record(name, raster.width, raster.height, async () =>
      rescale(await readAll(raster), scale),
    );
  }

  let full: { raster: Raster; scale: number } | null = null;
  const fullRaster = () => (full ??= rasterOf(bitmap, Infinity));

  if (!done()) {
    const { raster, scale } = fullRaster();
    await record('tiles', raster.width, raster.height, async () =>
      rescale(await readTiles(raster, readAll), scale),
    );
  }

  const plain = symbols.some((s) => s.format === 'MaxiCode');
  const report = {
    plain,
    cropped: null as boolean | null,
    croppedMs: null as number | null,
    candidates: null as number | null,
  };
  if (forceMaxiCode || symbols.length === 0) {
    const { raster, scale } = fullRaster();
    const t0 = performance.now();
    const read = await readMaxiCode(raster, readMaxiPure);
    const ms = performance.now() - t0;
    const found = rescale(read?.symbols ?? [], scale);
    steps.push({
      name: 'maxicode',
      ms,
      symbols: found.length,
      width: raster.width,
      height: raster.height,
    });
    report.cropped = found.length > 0;
    report.croppedMs = ms;
    report.candidates = read?.candidates ?? null;
    if (found.length > 0) {
      winner ??= 'maxicode';
      symbols = dedupeSymbols([...symbols, ...found]);
    }
  }

  return {
    symbols,
    steps,
    winner,
    maxicode: report,
    width: bitmap.width,
    height: bitmap.height,
    totalMs: performance.now() - startedAt,
  };
};

const reply = (message: WorkerResponse) => postMessage(message);

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, bitmap, options } = event.data;
  void (async () => {
    try {
      await ensureZxing();
      reply({ id, ok: true, result: await decode(bitmap, options) });
    } catch (error) {
      reply({
        id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      bitmap.close();
    }
  })();
};
