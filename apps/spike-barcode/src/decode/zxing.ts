import {
  prepareZXingModule,
  readBarcodes,
  type ReadableBarcodeFormat,
  type ZXingModuleOverrides,
} from 'zxing-wasm/reader';

export type Raster = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type Point = { x: number; y: number };

export type Quad = {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
};

export type Symbol = {
  format: string;
  text: string;
  isValid: boolean;
  position: Quad;
  orientation: number;
};

export type WasmSource =
  { wasmUrl: string } | { wasmBinary: ArrayBuffer | Uint8Array };

export const readableFormats = [
  'Code128',
  'Code39',
  'Code93',
  'ITF',
  'Codabar',
  'EAN13',
  'EAN8',
  'UPCA',
  'UPCE',
  'DataBar',
  'PDF417',
  'Aztec',
  'DataMatrix',
  'QRCode',
  'MaxiCode',
] as const satisfies readonly ReadableBarcodeFormat[];

export type ReadOptions = {
  formats?: readonly ReadableBarcodeFormat[];
  isPure?: boolean;
  tryHarder?: boolean;
  tryRotate?: boolean;
  tryInvert?: boolean;
  tryDownscale?: boolean;
  maxNumberOfSymbols?: number;
};

let ready: Promise<unknown> | null = null;

export const initZxing = (source: WasmSource) => {
  const locateFile: NonNullable<ZXingModuleOverrides['locateFile']> = (
    path,
    prefix,
  ) =>
    'wasmUrl' in source && path.endsWith('.wasm')
      ? source.wasmUrl
      : prefix + path;
  ready = prepareZXingModule({
    overrides:
      'wasmUrl' in source
        ? { locateFile }
        : { wasmBinary: toArrayBuffer(source.wasmBinary) },
    fireImmediately: true,
  });
  return ready.then(() => undefined);
};

const toArrayBuffer = (binary: ArrayBuffer | Uint8Array): ArrayBuffer => {
  if (binary instanceof ArrayBuffer) return binary;
  const copy = new Uint8Array(binary.byteLength);
  copy.set(binary);
  return copy.buffer;
};

export const readSymbols = async (
  raster: Raster,
  options: ReadOptions = {},
): Promise<Symbol[]> => {
  if (!ready) throw new Error('initZxing must be called before readSymbols');
  await ready;
  const results = await readBarcodes(raster as ImageData, {
    formats: [...(options.formats ?? readableFormats)],
    isPure: options.isPure ?? false,
    tryHarder: options.tryHarder ?? true,
    tryRotate: options.tryRotate ?? true,
    tryInvert: options.tryInvert ?? true,
    tryDownscale: options.tryDownscale ?? true,
    maxNumberOfSymbols: options.maxNumberOfSymbols ?? 8,
    textMode: 'Plain',
  });
  return results.map((r) => ({
    format: r.format,
    text: r.text,
    isValid: r.isValid,
    position: r.position,
    orientation: r.orientation,
  }));
};
