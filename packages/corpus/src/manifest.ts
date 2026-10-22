import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { manifestSchema, type Label } from '#schema';

export type Located = Label & { path: string };

export const readManifest = (file: string): Located[] => {
  const parsed = manifestSchema.safeParse(
    JSON.parse(readFileSync(file, 'utf8')),
  );
  if (!parsed.success) {
    throw new Error(`${file} : ${parsed.error.message}`);
  }
  const root = dirname(file);
  return parsed.data.map((label) => ({
    ...label,
    path: resolve(root, label.file),
  }));
};

export const missingFiles = (labels: Located[]) =>
  labels.filter((l) => !existsSync(l.path)).map((l) => l.path);
