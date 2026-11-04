import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeTracking } from '@repo/contract/tracking';

export const REPORT_FILE = 'rapport.json';
export const COMMENT_FILE = 'commentaire.txt';

/**
 * What the hook needs from a pulled report. The readings' shape is fixed by
 * the phone (YSL-143): only the image and a few fields are relied on, the
 * rest is read when it is there.
 */
export type PulledReport = {
  id: string;
  dir: string;
  imagePath: string;
  imageExt: 'jpg' | 'png';
  imageSha256: string;
  comment: string | null;
  /** Normalised, as the user corrected it or as the reader proposed it. */
  tracking: string | null;
  /** What was read or typed for the parcel: names, numbers. */
  personal: string[];
  /** Every text the report carries: none may reach the public repository. */
  texts: string[];
};

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const isObject = (value: unknown): value is Record<string, Json> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const at = (value: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>(
    (node, key) => (isObject(node) ? node[key] : undefined),
    value,
  );

const text = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() || null;
  if (isObject(value)) return text(value.value);
  return null;
};

export const sha256 = (data: string | Buffer) =>
  createHash('sha256').update(data).digest('hex');

/** The user's correction first: it is what the label really says. */
export const trackingOf = (report: unknown): string | null => {
  const corrections = at(report, 'corrections');
  const corrected = Array.isArray(corrections)
    ? corrections
        .filter((c) => at(c, 'field') === 'tracking')
        .map((c) => text(at(c, 'value')))
        .filter((value) => value !== null)
        .at(-1)
    : undefined;
  const raw =
    corrected ??
    text(at(report, 'fields', 'tracking')) ??
    text(at(report, 'draft', 'tracking')) ??
    text(at(report, 'extraction', 'fields', 'tracking')) ??
    text(at(report, 'tracking'));
  if (!raw) return null;
  const normalized = normalizeTracking(raw);
  return normalized.length >= 6 ? normalized : null;
};

export const textsOf = (value: unknown): string[] => {
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(textsOf);
  if (isObject(value)) return Object.values(value).flatMap(textsOf);
  return [];
};

export class ReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportError';
  }
}

export async function readReport(
  id: string,
  dir: string,
): Promise<PulledReport> {
  let detail: unknown;
  try {
    detail = JSON.parse(await readFile(join(dir, REPORT_FILE), 'utf8'));
  } catch {
    throw new ReportError(`${REPORT_FILE} absent ou illisible dans ${dir}.`);
  }
  if (at(detail, 'id') !== id) {
    throw new ReportError(`${REPORT_FILE} ne porte pas l'identifiant ${id}.`);
  }
  const imageExt = at(detail, 'imageType') === 'image/png' ? 'png' : 'jpg';
  const imagePath = join(dir, `image.${imageExt}`);
  if (!existsSync(imagePath)) {
    throw new ReportError(`Image absente : ${imagePath}.`);
  }
  const imageSha256 = sha256(await readFile(imagePath));
  const expected = at(detail, 'imageSha256');
  if (typeof expected === 'string' && expected !== imageSha256) {
    throw new ReportError('Image différente de son empreinte.');
  }
  const report = at(detail, 'report');
  const comment = text(at(detail, 'comment'));
  return {
    id,
    dir,
    imagePath,
    imageExt,
    imageSha256,
    comment,
    tracking: trackingOf(report),
    personal: [
      ...textsOf(at(report, 'fields')),
      ...textsOf(at(report, 'corrections')),
      ...textsOf(at(report, 'draft')),
    ],
    texts: [...textsOf(report), ...(comment ? [comment] : [])],
  };
}

/** Hashed: the registry on the PC does not need the number itself. */
export const labelKeys = (report: PulledReport): string[] => [
  ...(report.tracking ? [`tracking:${sha256(report.tracking)}`] : []),
  `image:${report.imageSha256}`,
];
