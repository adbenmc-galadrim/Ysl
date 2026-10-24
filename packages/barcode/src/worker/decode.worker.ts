import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { decodeSource, enoughFormats, type RasterSource } from '#cascade';
import { MAX_CANVAS_PIXELS } from '#tiles';
import { initZxing, type Raster } from '#zxing';
import type { WorkerRequest, WorkerResponse } from '#worker/protocol';

/**
 * Some WebKit builds refuse to stream-compile a `.wasm` served without the
 * exact MIME type; fetching the bytes and handing them over always works.
 */
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

const ensureZxing = () =>
  (loading ??= loadZxing().catch((error: unknown) => {
    loading = null;
    throw error;
  }));

const rasterOf = (bitmap: ImageBitmap, maxSide: number): Raster => {
  const longest = Math.max(bitmap.width, bitmap.height);
  const byPixels = Math.sqrt(
    MAX_CANVAS_PIXELS / (bitmap.width * bitmap.height),
  );
  const factor = Math.min(1, maxSide / longest, byPixels);
  const width = Math.max(1, Math.floor(bitmap.width * factor));
  const height = Math.max(1, Math.floor(bitmap.height * factor));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D unavailable');
  context.drawImage(bitmap, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  return { data, width, height };
};

const sourceOf = (bitmap: ImageBitmap): RasterSource => ({
  width: bitmap.width,
  height: bitmap.height,
  raster: (maxSide) => rasterOf(bitmap, maxSide),
});

const reply = (message: WorkerResponse) => postMessage(message);

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, bitmap, options } = event.data;
  void (async () => {
    try {
      await ensureZxing();
      const result = await decodeSource(sourceOf(bitmap), {
        thorough: options.thorough,
        enough: options.expect && enoughFormats(options.expect),
      });
      reply({ id, ok: true, result });
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
