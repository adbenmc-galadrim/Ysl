import { resolve } from 'node:path';

export const outDir = (out: string | undefined) =>
  resolve(out ?? resolve(import.meta.dirname, '../../out'));
