import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { initZxing } from './zxing.ts';

export const initZxingNode = () => {
  const path = createRequire(import.meta.url).resolve(
    'zxing-wasm/reader/zxing_reader.wasm',
  );
  return initZxing({ wasmBinary: readFileSync(path) });
};
